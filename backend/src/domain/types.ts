export type SafetyLevel = 'low' | 'medium' | 'high';
export type Severity = 'low' | 'medium' | 'high' | 'urgent';
export type CaseStatus = 'Draft' | 'In progress' | 'Resolved' | 'Closed';

export interface Device {
  id: string;
  name: string;
  brand: string;
  category: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  warrantyMonths: number;
  room: string;
  condition: string;
  createdAt: string;
}

export interface ManualEvidence {
  id: string;
  deviceId: string;
  title: string;
  section: string;
  excerpt: string;
  sourceLabel: string;
  sourceNote: string;
  sourceUrl: string;
  safetyLevel: SafetyLevel;
  keywords: string;
  createdAt: string;
  verified: boolean;
}

export interface WarrantyEvaluation {
  purchaseDate: string;
  warrantyMonths: number;
  calculatedExpiryDate: string;
  state: 'Active by recorded dates' | 'Expired by recorded dates' | 'No warranty recorded';
  daysRemaining: number;
  disclaimer: string;
}

export interface ServiceOption {
  id: string;
  label: string;
  description: string;
  estimatedResponse: string;
  type: 'self-check' | 'support' | 'qualified-service';
  illustrative: true;
}

export interface RepairCase {
  id: string;
  deviceId: string;
  deviceName: string;
  issue: string;
  status: CaseStatus;
  severity: Severity;
  warrantyState: string;
  summary: string;
  resolution: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string;
  sessionId: string;
  events?: CaseEvent[];
}

export interface CaseEvent {
  id: string;
  caseId: string;
  kind: string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface Investigation {
  sessionId: string;
  query: string;
  issue: string;
  device: Device | null;
  evidence: ManualEvidence[];
  warranty: WarrantyEvaluation | null;
  serviceOptions: ServiceOption[];
  severity: Severity;
  safetyGuidance: string[];
  recommendedNextSteps: string[];
  trace: Array<{ step: string; status: 'complete' | 'warning'; detail: string }>;
  disclaimer: string;
}

export interface DashboardData {
  devices: number;
  openCases: number;
  highPriority: number;
  activeWarranty: number;
  recentCases: RepairCase[];
  latestEvents: CaseEvent[];
}
