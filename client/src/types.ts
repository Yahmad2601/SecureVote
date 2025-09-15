import { Candidate } from "@shared/schema";

export interface DashboardStats {
  registeredVoters: number;
  votesCast: number;
  turnoutRate: number;
  activeDevices: number;
  totalDevices: number;
}

export interface VoteResult {
  candidateId: string;
  count: number;
  candidate: Candidate;
}

export interface VoteLog {
  id: string;
  voterId: string;
  maskedVoterId: string;
  candidateId?: string | null;
  candidateName: string;
  candidateParty?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  deviceLocation?: string | null;
  timestamp: string;
  verified: boolean;
}
