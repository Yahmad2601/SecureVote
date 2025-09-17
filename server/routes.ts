import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoteSchema, insertSecurityLogSchema, insertVoterSchema, insertActivityLogSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import { verifyPassword } from "./auth/password";
import { SESSION_COOKIE_NAME } from "./auth/session";

type SafeUser = Omit<User, "password">;

const sanitizeUser = (user: User): SafeUser => {
  const { password: _password, ...safeUser } = user;
  return safeUser;
};

const requireAuth: RequestHandler = (req, res, next) => {
  if (req.session?.userId) {
    return next();
  }

  res.status(401).json({ message: "Unauthorized" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body ?? {};

      if (typeof username !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const trimmedUsername = username.trim();
      const user = await storage.getUserByUsername(trimmedUsername);
      const isValid = user ? await verifyPassword(password, user.password) : false;

      if (!user || !isValid) {
        try {
          await storage.createSecurityLog({
            type: "login_attempt",
            severity: "medium",
            description: `Failed login attempt for username ${trimmedUsername}`,
            metadata: { username: trimmedUsername, ip: req.ip },
          });
        } catch (logError) {
          console.error("Failed to record security log for login attempt", logError);
        }

        return res.status(401).json({ message: "Invalid credentials" });
      }

      const safeUser = sanitizeUser(user);

      try {
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((regenerateError) => {
            if (regenerateError) {
              reject(regenerateError);
              return;
            }

            req.session.userId = user.id;
            req.session.user = safeUser;

            req.session.save((saveError) => {
              if (saveError) {
                reject(saveError);
                return;
              }
              resolve();
            });
          });
        });
      } catch (sessionError) {
        console.error("Failed to establish session", sessionError);
        return res.status(500).json({ message: "Failed to establish session" });
      }

      await storage.createActivityLog({
        type: "user_login",
        description: `User ${user.fullName} logged in`,
        userId: user.id,
        metadata: { username: trimmedUsername, ip: req.ip }
      });

      res.json({ user: safeUser });
    } catch (error) {
      console.error("Login failed", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    const sessionUserId = req.session?.userId;

    if (!sessionUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      if (!req.session.user) {
        const storedUser = await storage.getUser(sessionUserId);

        if (!storedUser) {
          await new Promise<void>((resolve) => {
            req.session?.destroy(() => resolve());
          });
          return res.status(401).json({ message: "Not authenticated" });
        }

        req.session.user = sanitizeUser(storedUser);
      }

      res.json({ user: req.session.user });
    } catch (error) {
      console.error("Failed to load session", error);
      res.status(500).json({ message: "Failed to load session" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    try {
      const sessionUser = req.session.user;
      const sessionUserId = req.session.userId;

      if (sessionUserId) {
        try {
          await storage.createActivityLog({
            type: "user_logout",
            description: `User ${sessionUser?.fullName ?? sessionUserId} logged out`,
            userId: sessionUserId,
            metadata: { username: sessionUser?.username, ip: req.ip },
          });
        } catch (logError) {
          console.error("Failed to record activity log for logout", logError);
        }
      }

      await new Promise<void>((resolve, reject) => {
        req.session.destroy((destroyError) => {
          if (destroyError) {
            reject(destroyError);
            return;
          }
          resolve();
        });
      });

      const isProduction = req.app.get("env") === "production";
      res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        sameSite: isProduction ? "strict" : "lax",
        secure: isProduction,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Logout failed", error);
      res.status(500).json({ message: "Logout failed" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Candidates
  app.get("/api/candidates", requireAuth, async (req, res) => {
    try {
      const candidates = await storage.getCandidates();
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch candidates" });
    }
  });

  // Votes and Results
  app.get("/api/votes/results", requireAuth, async (req, res) => {
    try {
      const results = await storage.getVotesByCandidate();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vote results" });
    }
  });

  // ESP32 vote submission endpoint
  app.post("/api/esp32/vote", requireAuth, async (req, res) => {
    try {
      const voteData = insertVoteSchema.parse(req.body);

      // Check if voter exists and hasn't voted
      const voter = await storage.getVoterByVoterId(voteData.voterId);
      if (!voter) {
        await storage.createSecurityLog({
          type: "unregistered_fingerprint",
          severity: "medium",
          deviceId: voteData.deviceId || undefined,
          voterId: voteData.voterId,
          description: `Unregistered voter ID ${voteData.voterId} attempted to vote`
        });
        return res.status(400).json({ message: "Voter not registered" });
      }

      if (voter.hasVoted) {
        await storage.createSecurityLog({
          type: "duplicate_attempt",
          severity: "high",
          deviceId: voteData.deviceId || undefined,
          voterId: voteData.voterId,
          description: `Duplicate vote attempt by voter ${voteData.voterId}`
        });
        return res.status(400).json({ message: "Voter has already voted" });
      }

      // Verify fingerprint hash
      if (voter.fingerprintHash !== voteData.fingerprintHash) {
        await storage.createSecurityLog({
          type: "unregistered_fingerprint",
          severity: "high",
          deviceId: voteData.deviceId || undefined,
          voterId: voteData.voterId,
          description: `Fingerprint mismatch for voter ${voteData.voterId}`
        });
        return res.status(400).json({ message: "Fingerprint verification failed" });
      }

      const device = voteData.deviceId ? await storage.getDevice(voteData.deviceId) : undefined;

      // Create vote with normalized device identifier when available
      const vote = await storage.createVote({
        ...voteData,
        deviceId: device?.id ?? voteData.deviceId ?? undefined,
      });

      // Update voter status
      await storage.updateVoterVoteStatus(voteData.voterId, true);

      // Update device sync using physical device identifier when available
      if (device) {
        await storage.updateDeviceSync(device.deviceId);
      } else if (voteData.deviceId) {
        await storage.updateDeviceSync(voteData.deviceId);
      }

      // Log activity
      await storage.createActivityLog({
        type: "vote_cast",
        description: `Vote cast by voter ${voteData.voterId.slice(0, 3)}***`,
        deviceId: device?.id,
        metadata: {
          maskedVoterId: voteData.voterId.slice(0, 3) + "***",
          deviceIdentifier: device?.deviceId ?? voteData.deviceId ?? null,
        }
      });

      res.json({ success: true, voteId: vote.id });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit vote" });
    }
  });

  app.get("/api/votes/logs", requireAuth, async (req, res) => {
    try {
      const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
      const limit = Number.isNaN(limitParam) ? 100 : limitParam;

      const [votes, candidates, devices] = await Promise.all([
        storage.getVotes(),
        storage.getCandidates(),
        storage.getDevices(),
      ]);

      const candidateMap = new Map(candidates.map(candidate => [candidate.id, candidate]));
      const deviceIdMap = new Map(devices.map(device => [device.id, device]));
      const deviceIdentifierMap = new Map(devices.map(device => [device.deviceId, device]));

      const sortedVotes = votes
        .slice()
        .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
        .slice(0, limit);

      const formatted = sortedVotes.map((vote) => {
        const candidate = vote.candidateId ? candidateMap.get(vote.candidateId) : undefined;
        const device = vote.deviceId
          ? deviceIdMap.get(vote.deviceId) ?? deviceIdentifierMap.get(vote.deviceId)
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
          timestamp: vote.timestamp ? new Date(vote.timestamp).toISOString() : new Date().toISOString(),
          verified: vote.verified ?? false,
        };
      });

      res.json(formatted);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vote logs" });
    }
  });

  // ESP32 voter sync endpoint
  app.get("/api/esp32/sync/:deviceId", requireAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;
      
      const voters = await storage.getVoters();
      const candidates = await storage.getCandidates();
      
      // Update device sync time
      await storage.updateDeviceSync(deviceId);
      
      const syncData = {
        voters: voters.map(v => ({
          id: v.voterId,
          fingerprint_hash: v.fingerprintHash,
          has_voted: v.hasVoted
        })),
        candidates: candidates.map(c => c.name)
      };

      res.json(syncData);
    } catch (error) {
      res.status(500).json({ message: "Failed to sync data" });
    }
  });

  // Voters
  app.get("/api/voters", requireAuth, async (req, res) => {
    try {
      const voters = await storage.getVoters();
      res.json(voters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch voters" });
    }
  });

  app.post("/api/voters", requireAuth, async (req, res) => {
    try {
      const voterData = insertVoterSchema.parse(req.body);
      const voter = await storage.createVoter(voterData);
      
      await storage.createActivityLog({
        type: "voter_registered",
        description: `New voter registered: ${voter.fullName} (${voter.voterId})`,
        metadata: { voterId: voter.voterId }
      });

      res.json(voter);
    } catch (error) {
      res.status(500).json({ message: "Failed to create voter" });
    }
  });

  app.post("/api/voters/bulk", requireAuth, async (req, res) => {
    try {
      const { voters: voterDataList } = req.body;
      const validatedVoters = voterDataList.map((v: any) => insertVoterSchema.parse(v));
      const voters = await storage.createVoters(validatedVoters);
      
      await storage.createActivityLog({
        type: "voter_registered",
        description: `Bulk import of ${voters.length} voters completed`,
        metadata: { count: voters.length }
      });

      res.json(voters);
    } catch (error) {
      res.status(500).json({ message: "Failed to import voters" });
    }
  });

  // Devices
  app.get("/api/devices", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getDevices();
      res.json(devices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch devices" });
    }
  });

  app.post("/api/devices/:deviceId/sync", requireAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;
      await storage.updateDeviceSync(deviceId);

      await storage.createActivityLog({
        type: "device_sync",
        description: `Device ${deviceId} manually synchronized`,
        metadata: { deviceId }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync device" });
    }
  });

  app.post("/api/devices/:deviceId/test-vote", requireAuth, async (req, res) => {
    try {
      const { deviceId } = req.params;
      const { candidateId } = req.body ?? {};

      const device = await storage.getDevice(deviceId);
      if (!device) {
        return res.status(404).json({ message: "Device not found" });
      }

      const voters = await storage.getVoters();
      const availableVoter = voters.find(voter => !voter.hasVoted);
      if (!availableVoter) {
        return res.status(400).json({ message: "No pending voters available for test vote" });
      }

      const candidates = await storage.getCandidates();
      if (candidates.length === 0) {
        return res.status(400).json({ message: "No candidates configured" });
      }

      const selectedCandidate = candidateId
        ? candidates.find(candidate => candidate.id === candidateId) ?? candidates[0]
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
        }
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
  app.get("/api/security-logs", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getSecurityLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch security logs" });
    }
  });

  app.post("/api/security-logs/:id/resolve", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.resolveSecurityLog(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to resolve security log" });
    }
  });

  // Activity logs
  app.get("/api/activity-logs", requireAuth, async (req, res) => {
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
