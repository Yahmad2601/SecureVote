import {
  type User,
  type InsertUser,
  type Voter,
  type InsertVoter,
  type Candidate,
  type InsertCandidate,
  type Device,
  type InsertDevice,
  type Vote,
  type InsertVote,
  type SecurityLog,
  type InsertSecurityLog,
  type ActivityLog,
  type InsertActivityLog,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { PostgreSQLStorage } from "./postgres-storage";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Voter methods
  getVoters(): Promise<Voter[]>;
  getVoter(id: string): Promise<Voter | undefined>;
  getVoterByVoterId(voterId: string): Promise<Voter | undefined>;
  createVoter(voter: InsertVoter): Promise<Voter>;
  createVoters(voters: InsertVoter[]): Promise<Voter[]>;
  updateVoterVoteStatus(voterId: string, hasVoted: boolean): Promise<void>;

  // Candidate methods
  getCandidates(): Promise<Candidate[]>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;

  // Device methods
  getDevices(): Promise<Device[]>;
  getDevice(deviceId: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDeviceStatus(
    deviceId: string,
    status: string,
    batteryLevel?: number
  ): Promise<void>;
  updateDeviceSync(deviceId: string): Promise<void>;

  // Vote methods
  getVotes(): Promise<Vote[]>;
  createVote(vote: InsertVote): Promise<Vote>;
  getVotesByCandidate(): Promise<
    { candidateId: string; count: number; candidate: Candidate }[]
  >;

  // Security log methods
  getSecurityLogs(): Promise<SecurityLog[]>;
  createSecurityLog(log: InsertSecurityLog): Promise<SecurityLog>;
  resolveSecurityLog(id: string): Promise<void>;

  // Activity log methods
  getActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    registeredVoters: number;
    votesCast: number;
    turnoutRate: number;
    activeDevices: number;
    totalDevices: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private voters: Map<string, Voter> = new Map();
  private candidates: Map<string, Candidate> = new Map();
  private devices: Map<string, Device> = new Map();
  private votes: Map<string, Vote> = new Map();
  private securityLogs: Map<string, SecurityLog> = new Map();
  private activityLogs: Map<string, ActivityLog> = new Map();

  constructor() {
    // Initialize with default admin user
    this.createUser({
      username: "admin",
      password: "Vulegbo", // In production, this should be hashed
      role: "super_admin",
      fullName: "System Administrator",
    });

    // Initialize with sample candidates
    this.createCandidate({
      name: "Candidate Alpha",
      party: "Democratic Party",
      position: 1,
    });
    this.createCandidate({
      name: "Candidate Beta",
      party: "Republican Party",
      position: 2,
    });
    this.createCandidate({
      name: "Candidate Gamma",
      party: "Independent",
      position: 3,
    });

    // Initialize with sample devices
    this.createDevice({
      deviceId: "machine_01",
      name: "Device-01",
      status: "online",
      batteryLevel: 87,
      location: "Building A",
    });
    this.createDevice({
      deviceId: "machine_02",
      name: "Device-02",
      status: "online",
      batteryLevel: 92,
      location: "Building B",
    });
    this.createDevice({
      deviceId: "machine_03",
      name: "Device-03",
      status: "warning",
      batteryLevel: 15,
      location: "Building C",
    });
    this.createDevice({
      deviceId: "machine_04",
      name: "Device-04",
      status: "offline",
      batteryLevel: 0,
      location: "Building D",
    });
    this.createDevice({
      deviceId: "machine_05",
      name: "Device-05",
      status: "online",
      batteryLevel: 76,
      location: "Building E",
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      role: insertUser.role || "observer",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getVoters(): Promise<Voter[]> {
    return Array.from(this.voters.values());
  }

  async getVoter(id: string): Promise<Voter | undefined> {
    return this.voters.get(id);
  }

  async getVoterByVoterId(voterId: string): Promise<Voter | undefined> {
    return Array.from(this.voters.values()).find(
      (voter) => voter.voterId === voterId
    );
  }

  async createVoter(insertVoter: InsertVoter): Promise<Voter> {
    const id = randomUUID();
    const voter: Voter = {
      ...insertVoter,
      id,
      hasVoted: false,
      createdAt: new Date(),
    };
    this.voters.set(id, voter);
    return voter;
  }

  async createVoters(insertVoters: InsertVoter[]): Promise<Voter[]> {
    const voters: Voter[] = [];
    for (const insertVoter of insertVoters) {
      const voter = await this.createVoter(insertVoter);
      voters.push(voter);
    }
    return voters;
  }

  async updateVoterVoteStatus(
    voterId: string,
    hasVoted: boolean
  ): Promise<void> {
    const voter = await this.getVoterByVoterId(voterId);
    if (voter) {
      voter.hasVoted = hasVoted;
      this.voters.set(voter.id, voter);
    }
  }

  async getCandidates(): Promise<Candidate[]> {
    return Array.from(this.candidates.values()).sort(
      (a, b) => a.position - b.position
    );
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const id = randomUUID();
    const candidate: Candidate = {
      ...insertCandidate,
      id,
      active: true,
    };
    this.candidates.set(id, candidate);
    return candidate;
  }

  async getDevices(): Promise<Device[]> {
    return Array.from(this.devices.values());
  }

  async getDevice(deviceId: string): Promise<Device | undefined> {
    return Array.from(this.devices.values()).find(
      (device) => device.deviceId === deviceId
    );
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const id = randomUUID();
    const device: Device = {
      id,
      deviceId: insertDevice.deviceId,
      name: insertDevice.name,
      status: insertDevice.status || "offline",
      batteryLevel: insertDevice.batteryLevel ?? 0,
      lastSync: new Date(),
      location: insertDevice.location ?? null,
      firmwareVersion: insertDevice.firmwareVersion ?? null,
    };
    this.devices.set(id, device);
    return device;
  }

  async updateDeviceStatus(
    deviceId: string,
    status: string,
    batteryLevel?: number
  ): Promise<void> {
    const device = await this.getDevice(deviceId);
    if (device) {
      device.status = status;
      if (batteryLevel !== undefined) {
        device.batteryLevel = batteryLevel;
      }
      this.devices.set(device.id, device);
    }
  }

  async updateDeviceSync(deviceId: string): Promise<void> {
    const device = await this.getDevice(deviceId);
    if (device) {
      device.lastSync = new Date();
      this.devices.set(device.id, device);
    }
  }

  async getVotes(): Promise<Vote[]> {
    return Array.from(this.votes.values());
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const id = randomUUID();
    const vote: Vote = {
      ...insertVote,
      id,
      deviceId: insertVote.deviceId || null,
      candidateId: insertVote.candidateId || null,
      timestamp: new Date(),
      verified: true,
    };
    this.votes.set(id, vote);
    return vote;
  }

  async getVotesByCandidate(): Promise<
    { candidateId: string; count: number; candidate: Candidate }[]
  > {
    const votes = Array.from(this.votes.values());
    const candidates = await this.getCandidates();
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));

    const voteCounts = new Map<string, number>();

    votes.forEach((vote) => {
      if (vote.candidateId) {
        voteCounts.set(
          vote.candidateId,
          (voteCounts.get(vote.candidateId) || 0) + 1
        );
      }
    });

    return Array.from(voteCounts.entries()).map(([candidateId, count]) => ({
      candidateId,
      count,
      candidate: candidateMap.get(candidateId)!,
    }));
  }

  async getSecurityLogs(): Promise<SecurityLog[]> {
    return Array.from(this.securityLogs.values()).sort(
      (a, b) =>
        new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
    );
  }

  async createSecurityLog(insertLog: InsertSecurityLog): Promise<SecurityLog> {
    const id = randomUUID();
    const log: SecurityLog = {
      ...insertLog,
      id,
      metadata: insertLog.metadata || null,
      severity: insertLog.severity || "medium",
      deviceId: insertLog.deviceId || null,
      voterId: insertLog.voterId || null,
      timestamp: new Date(),
      resolved: false,
    };
    this.securityLogs.set(id, log);
    return log;
  }

  async resolveSecurityLog(id: string): Promise<void> {
    const log = this.securityLogs.get(id);
    if (log) {
      log.resolved = true;
      this.securityLogs.set(id, log);
    }
  }

  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .sort(
        (a, b) =>
          new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime()
      )
      .slice(0, limit);
  }

  async createActivityLog(insertLog: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const log: ActivityLog = {
      ...insertLog,
      id,
      metadata: insertLog.metadata || null,
      deviceId: insertLog.deviceId || null,
      userId: insertLog.userId || null,
      timestamp: new Date(),
    };
    this.activityLogs.set(id, log);
    return log;
  }

  async getDashboardStats(): Promise<{
    registeredVoters: number;
    votesCast: number;
    turnoutRate: number;
    activeDevices: number;
    totalDevices: number;
  }> {
    const voters = await this.getVoters();
    const votes = await this.getVotes();
    const devices = await this.getDevices();

    const registeredVoters = voters.length;
    const votesCast = votes.length;
    const turnoutRate =
      registeredVoters > 0 ? (votesCast / registeredVoters) * 100 : 0;
    const activeDevices = devices.filter((d) => d.status === "online").length;
    const totalDevices = devices.length;

    return {
      registeredVoters,
      votesCast,
      turnoutRate,
      activeDevices,
      totalDevices,
    };
  }
}

// Create PostgreSQL storage instance
const pgStorage = new PostgreSQLStorage();

// Initialize the database with default data
async function initializeDatabase() {
  try {
    // Check if admin user exists
    const existingAdmin = await pgStorage.getUserByUsername("admin");
    if (!existingAdmin) {
      // Create default admin user
      await pgStorage.createUser({
        username: "admin",
        password: "Vulegbo", // In production, this should be hashed
        role: "super_admin",
        fullName: "System Administrator",
      });

      // Create sample candidates
      await pgStorage.createCandidate({
        name: "Bola Ahmed Tinubu",
        party: "All Progressive Congress (APC)",
        position: 1,
      });
      await pgStorage.createCandidate({
        name: "Atiku Abubakar",
        party: "African Democratic Congress (ADC)",
        position: 2,
      });
      await pgStorage.createCandidate({
        name: "Peter Obi",
        party: "Labour Party (LP)",
        position: 3,
      });

      // Create sample devices
      await pgStorage.createDevice({
        deviceId: "machine_01",
        name: "Device-01",
        status: "online",
        batteryLevel: 87,
        location: "Building A",
      });
      await pgStorage.createDevice({
        deviceId: "machine_02",
        name: "Device-02",
        status: "online",
        batteryLevel: 92,
        location: "Building B",
      });
      await pgStorage.createDevice({
        deviceId: "machine_03",
        name: "Device-03",
        status: "warning",
        batteryLevel: 15,
        location: "Building C",
      });
      await pgStorage.createDevice({
        deviceId: "machine_04",
        name: "Device-04",
        status: "offline",
        batteryLevel: 0,
        location: "Building D",
      });
      await pgStorage.createDevice({
        deviceId: "machine_05",
        name: "Device-05",
        status: "online",
        batteryLevel: 76,
        location: "Building E",
      });

      console.log("Database initialized with default data");
    }
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Initialize database on startup
initializeDatabase();

export const storage = pgStorage;
