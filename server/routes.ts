import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertVoteSchema, insertSecurityLogSchema, insertVoterSchema, insertActivityLogSchema } from "@shared/schema";

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
        metadata: { username }
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
      
      // Check if voter exists and hasn't voted
      const voter = await storage.getVoterByVoterId(voteData.voterId);
      if (!voter) {
        await storage.createSecurityLog({
          type: "unregistered_fingerprint",
          severity: "medium",
          deviceId: voteData.deviceId,
          voterId: voteData.voterId,
          description: `Unregistered voter ID ${voteData.voterId} attempted to vote`
        });
        return res.status(400).json({ message: "Voter not registered" });
      }

      if (voter.hasVoted) {
        await storage.createSecurityLog({
          type: "duplicate_attempt",
          severity: "high",
          deviceId: voteData.deviceId,
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
          deviceId: voteData.deviceId,
          voterId: voteData.voterId,
          description: `Fingerprint mismatch for voter ${voteData.voterId}`
        });
        return res.status(400).json({ message: "Fingerprint verification failed" });
      }

      // Create vote
      const vote = await storage.createVote(voteData);
      
      // Update voter status
      await storage.updateVoterVoteStatus(voteData.voterId, true);

      // Update device sync
      if (voteData.deviceId) {
        await storage.updateDeviceSync(voteData.deviceId);
      }

      // Log activity
      await storage.createActivityLog({
        type: "vote_cast",
        description: `Vote cast by voter ${voteData.voterId.slice(0, 3)}***`,
        deviceId: voteData.deviceId,
        metadata: { maskedVoterId: voteData.voterId.slice(0, 3) + "***" }
      });

      res.json({ success: true, voteId: vote.id });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit vote" });
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
        metadata: { voterId: voter.voterId }
      });

      res.json(voter);
    } catch (error) {
      res.status(500).json({ message: "Failed to create voter" });
    }
  });

  app.post("/api/voters/bulk", async (req, res) => {
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
        metadata: { deviceId }
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync device" });
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
