import { z } from "zod";

export const investmentSchema = z.object({
  ideaId: z.string().min(1, "Idea ID is required"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .int("Amount must be an integer")
    .min(10, "Minimum investment is 10 coins")
    .max(50, "Maximum investment is 50 coins"),
});

export const ideaSubmissionSchema = z.object({
  teamName: z.string().min(2, "Team name must be at least 2 characters").max(60),
  problem: z.string().min(20, "Problem statement must be at least 20 characters").max(500),
  solution: z.string().min(20, "Solution must be at least 20 characters").max(500),
  innovation: z.string().min(20, "Core innovation must be at least 20 characters").max(500),
  impact: z.string().min(20, "Impact & scale must be at least 20 characters").max(500),
  whyInvest: z.string().min(20, "Why invest pitch must be at least 20 characters").max(500),
  techStack: z.string().min(5, "Technology stack must be at least 5 characters").max(300),
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const eventControlSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'PAUSED', 'CLOSED', 'REVEALED']),
  minPerIdea: z.number().int().min(1),
  maxPerIdea: z.number().int().min(1),
  totalBudget: z.number().int().min(10),
});
