// ============================================================
// Database Schema — 3 modules
//   Module 1 (Reverse): projects, codeAnalysis, recommendations
//   Module 2 (Loops):   loops, loopNodes, loopEdges
//   Module 3 (Metrics): codeSamples, metricEvents, scoreHistory
// ============================================================
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ---------- Module 1: Reverse Engineering ----------
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  source: text('source_type').notNull(), // 'git' | 'upload' | 'paste'
  sourceRef: text('source_ref'),          // git url / filename
  createdAt: integer('created_at').notNull(),
});

export const codeAnalysis = sqliteTable('code_analysis', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  // Detected facts
  languages: text('languages').notNull(),        // JSON string[]
  frameworks: text('frameworks').notNull(),      // JSON string[]
  projectType: text('project_type'),
  archPatterns: text('arch_patterns'),           // JSON string[]
  // Detected issues (the killer feature — find problems in existing code)
  issues: text('issues').notNull(),              // JSON Issue[]
  // Stats
  fileCount: integer('file_count').notNull(),
  lineCount: integer('line_count').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  analysisId: text('analysis_id').notNull().references(() => codeAnalysis.id),
  kind: text('kind').notNull(),        // 'agent' | 'skill' | 'rule' | 'mcp' | 'loop'
  name: text('name').notNull(),
  reason: text('reason').notNull(),    // why we recommend this (ties to detected issue)
  severity: text('severity').notNull(),// 'info' | 'warning' | 'critical'
  platformTargets: text('platform_targets'), // JSON string[]
  payload: text('payload').notNull(),  // JSON config object
  accepted: integer('accepted', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at').notNull(),
});

// ---------- Module 2: Multi-Agent Loops ----------
export const loops = sqliteTable('loops', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  pattern: text('pattern').notNull(),  // 'pipeline' | 'parallel' | 'worker-leader' | 'specialist-router'
  // The flow definition (nodes + edges serialized)
  graph: text('graph').notNull(),      // JSON { nodes, edges }
  // Compile targets (which platforms to export)
  targets: text('targets').notNull(),  // JSON string[]
  // AI 生成上下文（freeText + 上传文件名列表），用于重新生成
  meta: text('meta'),                  // JSON { freeText, uploadedFiles }
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ---------- Module 3: AI Code Quality Dashboard ----------
export const codeSamples = sqliteTable('code_samples', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  source: text('source').notNull(),     // 'pr' | 'paste' | 'git-diff'
  filePath: text('file_path').notNull(),
  content: text('content').notNull(),
  aiGenerated: integer('ai_generated', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at').notNull(),
});

export const metricEvents = sqliteTable('metric_events', {
  id: text('id').primaryKey(),
  sampleId: text('sample_id').notNull().references(() => codeSamples.id),
  rule: text('rule').notNull(),         // e.g. 'naming-case', 'no-any', 'has-tests'
  passed: integer('passed', { mode: 'boolean' }).notNull(),
  severity: text('severity').notNull(), // 'info' | 'warning' | 'critical'
  detail: text('detail'),
  createdAt: integer('created_at').notNull(),
});

export const scoreHistory = sqliteTable('score_history', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  // Dimensions scored 0-100
  styleScore: real('style_score').notNull(),
  securityScore: real('security_score').notNull(),
  testScore: real('test_score').notNull(),
  archScore: real('arch_score').notNull(),
  overall: real('overall').notNull(),
  // Attribution — which configs contributed
  topContributors: text('top_contributors'), // JSON
  createdAt: integer('created_at').notNull(),
});

// ---------- Type Inference Helpers ----------
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type CodeAnalysisRow = typeof codeAnalysis.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type Loop = typeof loops.$inferSelect;
export type NewLoop = typeof loops.$inferInsert;
export type CodeSample = typeof codeSamples.$inferSelect;
export type MetricEvent = typeof metricEvents.$inferSelect;
export type ScoreHistory = typeof scoreHistory.$inferSelect;
