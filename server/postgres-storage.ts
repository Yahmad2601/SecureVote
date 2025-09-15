import { eq, desc, sql, count } from "drizzle-orm";
import { db } from "./db";
import { 
  users, voters, candidates, devices, votes, securityLogs, activityLogs,
  type User, type InsertUser, type Voter, type InsertVoter, 
  type Candidate, type InsertCandidate, type Device, type InsertDevice,
  type Vote, type InsertVote, type SecurityLog, type InsertSecurityLog,
  type ActivityLog, type InsertActivityLog
} from "@shared/schema";
import type { IStorage } from "./storage";

export class PostgreSQLStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Voter methods
  async getVoters(): Promise<Voter[]> {
    return await db.select().from(voters).orderBy(voters.createdAt);
  }

  async getVoter(id: string): Promise<Voter | undefined> {
    const result = await db.select().from(voters).where(eq(voters.id, id)).limit(1);
    return result[0];
  }

  async getVoterByVoterId(voterId: string): Promise<Voter | undefined> {
    const result = await db.select().from(voters).where(eq(voters.voterId, voterId)).limit(1);
    return result[0];
  }

  async createVoter(voter: InsertVoter): Promise<Voter> {
    const result = await db.insert(voters).values(voter).returning();
    return result[0];
  }

  async createVoters(voterList: InsertVoter[]): Promise<Voter[]> {
    const result = await db.insert(voters).values(voterList).returning();
    return result;
  }

  async updateVoterVoteStatus(voterId: string, hasVoted: boolean): Promise<void> {
    await db.update(voters)
      .set({ hasVoted })
      .where(eq(voters.voterId, voterId));
  }

  // Candidate methods
  async getCandidates(): Promise<Candidate[]> {
    return await db.select().from(candidates).orderBy(candidates.position);
  }

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const result = await db.insert(candidates).values(candidate).returning();
    return result[0];
  }

  // Device methods
  async getDevices(): Promise<Device[]> {
    return await db.select().from(devices);
  }

  async getDevice(deviceId: string): Promise<Device | undefined> {
    const result = await db.select().from(devices).where(eq(devices.deviceId, deviceId)).limit(1);
    return result[0];
  }

  async createDevice(device: InsertDevice): Promise<Device> {
    const result = await db.insert(devices).values(device).returning();
    return result[0];
  }

  async updateDeviceStatus(deviceId: string, status: string, batteryLevel?: number): Promise<void> {
    const updateData: any = { status };
    if (batteryLevel !== undefined) {
      updateData.batteryLevel = batteryLevel;
    }
    await db.update(devices)
      .set(updateData)
      .where(eq(devices.deviceId, deviceId));
  }

  async updateDeviceSync(deviceId: string): Promise<void> {
    await db.update(devices)
      .set({ lastSync: new Date() })
      .where(eq(devices.deviceId, deviceId));
  }

  // Vote methods
  async getVotes(): Promise<Vote[]> {
    return await db.select().from(votes).orderBy(desc(votes.timestamp));
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    const result = await db.insert(votes).values(vote).returning();
    return result[0];
  }

  async getVotesByCandidate(): Promise<{ candidateId: string; count: number; candidate: Candidate }[]> {
    const voteResults = await db
      .select({
        candidateId: votes.candidateId,
        count: count(votes.id)
      })
      .from(votes)
      .where(sql`${votes.candidateId} IS NOT NULL`)
      .groupBy(votes.candidateId);

    const candidatesList = await this.getCandidates();
    const candidateMap = new Map(candidatesList.map(c => [c.id, c]));

    return voteResults
      .filter(result => result.candidateId && candidateMap.has(result.candidateId))
      .map(result => ({
        candidateId: result.candidateId!,
        count: result.count,
        candidate: candidateMap.get(result.candidateId!)!
      }));
  }

  // Security log methods
  async getSecurityLogs(): Promise<SecurityLog[]> {
    return await db.select().from(securityLogs).orderBy(desc(securityLogs.timestamp));
  }

  async createSecurityLog(log: InsertSecurityLog): Promise<SecurityLog> {
    const result = await db.insert(securityLogs).values(log).returning();
    return result[0];
  }

  async resolveSecurityLog(id: string): Promise<void> {
    await db.update(securityLogs)
      .set({ resolved: true })
      .where(eq(securityLogs.id, id));
  }

  // Activity log methods
  async getActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs)
      .orderBy(desc(activityLogs.timestamp))
      .limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(log).returning();
    return result[0];
  }

  // Dashboard stats
  async getDashboardStats(): Promise<{
    registeredVoters: number;
    votesCast: number;
    turnoutRate: number;
    activeDevices: number;
    totalDevices: number;
  }> {
    const [voterCount] = await db.select({ count: count() }).from(voters);
    const [voteCount] = await db.select({ count: count() }).from(votes);
    const [deviceCount] = await db.select({ count: count() }).from(devices);
    const [activeDeviceCount] = await db.select({ count: count() }).from(devices).where(eq(devices.status, "online"));

    const registeredVoters = voterCount.count;
    const votesCast = voteCount.count;
    const turnoutRate = registeredVoters > 0 ? (votesCast / registeredVoters) * 100 : 0;
    const activeDevices = activeDeviceCount.count;
    const totalDevices = deviceCount.count;

    return {
      registeredVoters,
      votesCast,
      turnoutRate,
      activeDevices,
      totalDevices
    };
  }
}