import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertVoteSchema,
  insertSecurityLogSchema,
  insertVoterSchema,
  insertActivityLogSchema,
} from "../shared/schema.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      await storage.createActivityLog({
        type: "user_login",
        description: `User ${user.fullName} logged in`,
        userId: user.id,
        metadata: { username },
      });

      res.json({ user: { ...user, password: undefined } });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Candidates
  app.get("/api/candidates", async (req, res) => {
    try {
      const candidates = await storage.getCandidates();
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch candidates" });
    }
  });

  // Votes and Results
  app.get("/api/votes/results", async (req, res) => {
    try {
      const results = await storage.getVotesByCandidate();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vote results" });
    }
  });

  // ESP32 vote submission endpoint
  app.post("/api/esp32/vote", async (req, res) => {
    try {
      const voteData = insertVoteSchema.parse(req.body);

      // Convert Unix timestamp to Date if provided
      let voteTimestamp = new Date();
      if (voteData.timestamp) {
        if (typeof voteData.timestamp === "number") {
          voteTimestamp = new Date(voteData.timestamp * 1000);
        } else {
          voteTimestamp = voteData.timestamp;
        }
      }

      // Check if voter exists
      const voter = await storage.getVoterByVoterId(voteData.voterId);
      if (!voter) {
        await storage.createSecurityLog({
          type: "unregistered_fingerprint",
          severity: "medium",
          deviceId: voteData.deviceId || undefined,
          voterId: voteData.voterId,
          description: `Unregistered voter ID ${voteData.voterId} attempted to vote`,
          metadata: {
            confidence: voteData.confidence,
            signalStrength: voteData.signalStrength,
          },
        });
        return res.status(400).json({
          message: "Voter not registered",
          success: false,
        });
      }

      // Check if voter has already voted
      if (voter.hasVoted) {
        await storage.createSecurityLog({
          type: "duplicate_attempt",
          severity: "high",
          deviceId: voteData.deviceId || undefined,
          voterId: voteData.voterId,
          description: `Duplicate vote attempt by voter ${voteData.voterId}`,
          metadata: {
            confidence: voteData.confidence,
            signalStrength: voteData.signalStrength,
          },
        });
        return res.status(400).json({
          message: "Voter has already voted",
          success: false,
          hasVoted: true,
        });
      }

      // Verify fingerprint hash
      if (voter.fingerprintHash !== voteData.fingerprintHash) {
        await storage.createSecurityLog({
          type: "unregistered_fingerprint",
          severity: "high",
          deviceId: voteData.deviceId || undefined,
          voterId: voteData.voterId,
          description: `Fingerprint mismatch for voter ${voteData.voterId}`,
          metadata: {
            confidence: voteData.confidence,
            expectedHash: voter.fingerprintHash.substring(0, 8) + "...",
            receivedHash: voteData.fingerprintHash.substring(0, 8) + "...",
          },
        });
        return res.status(400).json({
          message: "Fingerprint verification failed",
          success: false,
        });
      }

      // Check confidence threshold (if provided)
      if (voteData.confidence && voteData.confidence < 50) {
        await storage.createSecurityLog({
          type: "low_confidence",
          severity: "medium",
          deviceId: voteData.deviceId || undefined,
          voterId: voteData.voterId,
          description: `Low fingerprint confidence: ${voteData.confidence}`,
          metadata: { confidence: voteData.confidence },
        });
        return res.status(400).json({
          message: "Fingerprint confidence too low",
          success: false,
          confidence: voteData.confidence,
        });
      }

      const device = voteData.deviceId
        ? await storage.getDevice(voteData.deviceId)
        : undefined;

      // Find candidate by name (ESP32 sends candidate name, not ID)
      let candidateId = voteData.candidateId;
      if (
        typeof voteData.candidateId === "string" &&
        !voteData.candidateId.includes("-")
      ) {
        // It's a candidate name, find the ID
        const candidates = await storage.getCandidates();
        const candidate = candidates.find(
          (c) => c.name === voteData.candidateId
        );
        if (candidate) {
          candidateId = candidate.id;
        }
      }

      // Create vote with all metadata
      const vote = await storage.createVote({
        ...voteData,
        candidateId,
        deviceId: device?.id ?? voteData.deviceId ?? undefined,
        timestamp: voteTimestamp,
        confidence: voteData.confidence,
        signalStrength: voteData.signalStrength,
      });

      // Update voter status
      await storage.updateVoterVoteStatus(voteData.voterId, true);

      // Update device sync
      if (device) {
        await storage.updateDeviceSync(device.deviceId);
      } else if (voteData.deviceId) {
        await storage.updateDeviceSync(voteData.deviceId);
      }

      // Log activity with metadata
      await storage.createActivityLog({
        type: "vote_cast",
        description: `Vote cast by voter ${voteData.voterId.slice(
          0,
          3
        )}*** with confidence ${voteData.confidence || "N/A"}`,
        deviceId: device?.id,
        metadata: {
          maskedVoterId: voteData.voterId.slice(0, 3) + "***",
          deviceIdentifier: device?.deviceId ?? voteData.deviceId ?? null,
          confidence: voteData.confidence,
          signalStrength: voteData.signalStrength,
          timestamp: voteTimestamp.toISOString(),
        },
      });

      res.json({
        success: true,
        voteId: vote.id,
        message: "Vote submitted successfully",
      });
    } catch (error) {
      console.error("Vote submission error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        message: "Failed to submit vote",
        success: false,
        error: message,
      });
    }
  });

  // Offline vote sync endpoint
  app.post("/api/esp32/sync-offline-votes", async (req, res) => {
    try {
      const { votes: offlineVotes, deviceId } = req.body;

      if (!Array.isArray(offlineVotes) || offlineVotes.length === 0) {
        return res.status(400).json({
          message: "No offline votes to sync",
          success: false,
        });
      }

      const results = {
        total: offlineVotes.length,
        successful: 0,
        failed: 0,
        errors: [] as { voterId: string; reason: string }[],
      };

      for (const voteData of offlineVotes) {
        try {
          // Validate and process each vote
          const validatedVote = insertVoteSchema.parse(voteData);

          // Check if already submitted (by timestamp or voter ID)
          const existingVote = await storage.getVoterByVoterId(
            validatedVote.voterId
          );
          if (existingVote && existingVote.hasVoted) {
            results.failed++;
            results.errors.push({
              voterId: validatedVote.voterId,
              reason: "Already voted",
            });
            continue;
          }

          // Submit the vote (reuse existing logic)
          await storage.createVote({
            ...validatedVote,
            timestamp:
              typeof validatedVote.timestamp === "number"
                ? new Date(validatedVote.timestamp * 1000)
                : new Date(),
          });

          await storage.updateVoterVoteStatus(validatedVote.voterId, true);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            voterId: voteData.voterId || "unknown",
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      await storage.createActivityLog({
        type: "device_sync",
        description: `Synced ${results.successful} offline votes from device ${deviceId}`,
        metadata: {
          deviceId,
          total: results.total,
          successful: results.successful,
          failed: results.failed,
        },
      });

      res.json({
        success: true,
        results,
        message: `Synced ${results.successful}/${results.total} offline votes`,
      });
    } catch (error) {
      console.error("Offline vote sync error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        message: "Failed to sync offline votes",
        success: false,
        error: message,
      });
    }
  });

  // Device health check endpoint
  app.post("/api/esp32/health/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { batteryLevel, signalStrength, freeMemory } = req.body;

      const device = await storage.getDevice(deviceId);
      if (!device) {
        return res.status(404).json({
          message: "Device not found",
          success: false,
        });
      }

      // Update device status based on battery level
      let status = "online";
      if (batteryLevel < 15) {
        status = "warning";
      } else if (batteryLevel === 0) {
        status = "offline";
      }

      await storage.updateDeviceStatus(deviceId, status, batteryLevel);

      // Log health check
      await storage.createActivityLog({
        type: "device_sync",
        description: `Health check from device ${deviceId}`,
        deviceId: device.id,
        metadata: {
          batteryLevel,
          signalStrength,
          freeMemory,
          status,
        },
      });

      res.json({
        success: true,
        status,
        message: "Health check recorded",
      });
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({
        message: "Failed to record health check",
        success: false,
      });
    }
  });

  app.get("/api/votes/logs", async (req, res) => {
    try {
      const limitParam = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 100;
      const limit = Number.isNaN(limitParam) ? 100 : limitParam;

      const [votes, candidates, devices] = await Promise.all([
        storage.getVotes(),
        storage.getCandidates(),
        storage.getDevices(),
      ]);

      const candidateMap = new Map(
        candidates.map((candidate) => [candidate.id, candidate])
      );
      const deviceIdMap = new Map(devices.map((device) => [device.id, device]));
      const deviceIdentifierMap = new Map(
        devices.map((device) => [device.deviceId, device])
      );

      const sortedVotes = votes
        .slice()
        .sort(
          (a, b) =>
            new Date(b.timestamp ?? 0).getTime() -
            new Date(a.timestamp ?? 0).getTime()
        )
        .slice(0, limit);

      const formatted = sortedVotes.map((vote) => {
        const candidate = vote.candidateId
          ? candidateMap.get(vote.candidateId)
          : undefined;
        const device = vote.deviceId
          ? deviceIdMap.get(vote.deviceId) ??
            deviceIdentifierMap.get(vote.deviceId)
          : undefined;

        return {
          id: vote.id,
          voterId: vote.voterId,
          maskedVoterId: `${vote.voterId.slice(0, 3)}***`,
          candidateId: vote.candidateId,
          candidateName: candidate?.name ?? "Unknown Candidate",
          candidateParty: candidate?.party ?? null,
          deviceId: device?.deviceId ?? vote.deviceId ?? null,
          deviceName: device?.name ?? null,
          deviceLocation: device?.location ?? null,
          timestamp: vote.timestamp
            ? new Date(vote.timestamp).toISOString()
            : new Date().toISOString(),
          verified: vote.verified ?? false,
          confidence: vote.confidence, // ADD THIS
          signalStrength: vote.signalStrength, // ADD THIS
        };
      });

      res.json(formatted);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vote logs" });
    }
  });

  // ESP32 voter sync endpoint
  app.get("/api/esp32/sync/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;

      const voters = await storage.getVoters();
      const candidates = await storage.getCandidates();

      // Update device sync time
      await storage.updateDeviceSync(deviceId);

      const syncData = {
        voters: voters.map((v) => ({
          id: v.voterId,
          fingerprint_hash: v.fingerprintHash,
          has_voted: v.hasVoted,
        })),
        candidates: candidates.map((c) => c.name),
      };

      res.json(syncData);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync data" });
    }
  });

  // Voters
  app.get("/api/voters", async (req, res) => {
    try {
      const voters = await storage.getVoters();
      res.json(voters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch voters" });
    }
  });

  app.post("/api/voters", async (req, res) => {
    try {
      const voterData = insertVoterSchema.parse(req.body);
      const voter = await storage.createVoter(voterData);

      await storage.createActivityLog({
        type: "voter_registered",
        description: `New voter registered: ${voter.fullName} (${voter.voterId})`,
        metadata: { voterId: voter.voterId },
      });

      res.json(voter);
    } catch (error) {
      res.status(500).json({ message: "Failed to create voter" });
    }
  });

  app.post("/api/voters/bulk", async (req, res) => {
    try {
      const { voters: voterDataList } = req.body;
      const validatedVoters = voterDataList.map((v: any) =>
        insertVoterSchema.parse(v)
      );
      const voters = await storage.createVoters(validatedVoters);

      await storage.createActivityLog({
        type: "voter_registered",
        description: `Bulk import of ${voters.length} voters completed`,
        metadata: { count: voters.length },
      });

      res.json(voters);
    } catch (error) {
      res.status(500).json({ message: "Failed to import voters" });
    }
  });

  // Devices
  app.get("/api/devices", async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.post("/api/devices/:deviceId/sync", async (req, res) => {
    try {
      const { deviceId } = req.params;
      await storage.updateDeviceSync(deviceId);

      await storage.createActivityLog({
        type: "device_sync",
        description: `Device ${deviceId} manually synchronized`,
        metadata: { deviceId },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync device" });
    }
  });

  app.post("/api/devices/:deviceId/test-vote", async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { candidateId } = req.body ?? {};

      const device = await storage.getDevice(deviceId);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const voters = await storage.getVoters();
      const availableVoter = voters.find((voter) => !voter.hasVoted);
      if (!availableVoter) {
        return res
          .status(400)
          .json({ message: "No pending voters available for test vote" });
      }

      const candidates = await storage.getCandidates();
      if (candidates.length === 0) {
        return res.status(400).json({ message: "No candidates configured" });
      }

      const selectedCandidate = candidateId
        ? candidates.find((candidate) => candidate.id === candidateId) ??
          candidates[0]
        : candidates[0];

      const votePayload = insertVoteSchema.parse({
        voterId: availableVoter.voterId,
        candidateId: selectedCandidate.id,
        fingerprintHash: availableVoter.fingerprintHash,
        deviceId: device.id ?? device.deviceId,
      });

      const vote = await storage.createVote(votePayload);

      await storage.updateVoterVoteStatus(availableVoter.voterId, true);
      await storage.updateDeviceSync(device.deviceId);

      await storage.createActivityLog({
        type: "vote_cast",
        description: `Test vote cast for ${selectedCandidate.name} from device ${device.deviceId}`,
        deviceId: device.id,
        metadata: {
          maskedVoterId: availableVoter.voterId.slice(0, 3) + "***",
          testVote: true,
          deviceIdentifier: device.deviceId,
          candidateName: selectedCandidate.name,
        },
      });

      res.json({
        success: true,
        voteId: vote.id,
        voterId: availableVoter.voterId,
        candidateId: selectedCandidate.id,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit test vote" });
    }
  });

  // Security logs
  app.get("/api/security-logs", async (req, res) => {
    try {
      const logs = await storage.getSecurityLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch security logs" });
    }
  });

  app.post("/api/security-logs/:id/resolve", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.resolveSecurityLog(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve security log" });
    }
  });

  // Activity logs
  app.get("/api/activity-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getActivityLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
