"use server";

import { randomInt } from "node:crypto";
import { getDb } from "@/db";
import { funds, outbox } from "@/db/schema";
import {
  closeDateFor,
  expiryDateFor,
  formatPence,
  parsePoundsToPence,
} from "@/lib/fund-rules";
import { isValidEmail } from "@/lib/validation";

export type FieldName =
  | "mumFirstName"
  | "mumEmail"
  | "organiserEmail"
  | "dueDate"
  | "goal"
  | "note";

export type CreateFundState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<FieldName, string>>;
      values: Record<FieldName, string>;
    }
  | {
      status: "error";
      message: string;
      values: Record<FieldName, string>;
    }
  | {
      status: "created";
      slug: string;
      mumFirstName: string;
      closeDate: string;
      expiryDate: string;
    };

function slugBase(firstName: string, dueDate: string): string {
  const normalizedName = firstName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = normalizedName.length > 0 ? normalizedName : "fund";
  const yyyymm = dueDate.slice(0, 7).replace("-", "");
  return `${base}-${yyyymm}`;
}

function randomSuffix(length = 4): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[randomInt(0, 36)];
  }
  return result;
}

function isSlugUniqueViolation(error: unknown): boolean {
  const candidate =
    error && typeof error === "object" && "cause" in error && error.cause
      ? error.cause
      : error;

  if (candidate && typeof candidate === "object") {
    const err = candidate as Record<string, unknown>;
    const code = err.code ?? (error as Record<string, unknown> | null)?.code;
    const constraint =
      err.constraint ?? (error as Record<string, unknown> | null)?.constraint;
    const message =
      typeof err.message === "string"
        ? err.message
        : typeof (error as Record<string, unknown> | null)?.message === "string"
          ? ((error as Record<string, unknown>).message as string)
          : "";

    const isCode23505 = code === "23505";
    const matchesConstraint =
      constraint === "funds_slug_unique" ||
      message.includes("funds_slug_unique");

    if (isCode23505 && matchesConstraint) {
      return true;
    }
  }
  return false;
}

export async function createFund(
  _prevState: CreateFundState,
  formData: FormData
): Promise<CreateFundState> {
  const rawValues: Record<FieldName, string> = {
    mumFirstName:
      typeof formData.get("mumFirstName") === "string"
        ? (formData.get("mumFirstName") as string)
        : "",
    mumEmail:
      typeof formData.get("mumEmail") === "string"
        ? (formData.get("mumEmail") as string)
        : "",
    organiserEmail:
      typeof formData.get("organiserEmail") === "string"
        ? (formData.get("organiserEmail") as string)
        : "",
    dueDate:
      typeof formData.get("dueDate") === "string"
        ? (formData.get("dueDate") as string)
        : "",
    goal:
      typeof formData.get("goal") === "string"
        ? (formData.get("goal") as string)
        : "",
    note:
      typeof formData.get("note") === "string"
        ? (formData.get("note") as string)
        : "",
  };

  const errors: Partial<Record<FieldName, string>> = {};

  const mumFirstName = rawValues.mumFirstName.trim();
  if (mumFirstName.length === 0) {
    errors.mumFirstName = "Please enter the mum's first name.";
  } else if (mumFirstName.length > 50) {
    errors.mumFirstName = "First name must be 50 characters or fewer.";
  }

  const mumEmail = rawValues.mumEmail.trim();
  if (mumEmail.length === 0) {
    errors.mumEmail = "Please enter the mum's email address.";
  } else if (!isValidEmail(mumEmail)) {
    errors.mumEmail = "Please enter a valid email address.";
  }

  const organiserEmail = rawValues.organiserEmail.trim();
  if (organiserEmail.length > 0 && !isValidEmail(organiserEmail)) {
    errors.organiserEmail = "Please enter a valid email address.";
  }

  const dueDate = rawValues.dueDate.trim();
  let closeDate = "";
  if (dueDate.length === 0) {
    errors.dueDate = "Please enter a due date.";
  } else {
    try {
      closeDate = closeDateFor(dueDate);
    } catch {
      errors.dueDate = "Please enter a valid date in YYYY-MM-DD format.";
    }
  }

  const goalStr = rawValues.goal.trim();
  let goalPence: number | null = null;
  if (goalStr.length > 0) {
    goalPence = parsePoundsToPence(goalStr);
    if (goalPence === null || goalPence <= 0) {
      errors.goal = "Goal must be greater than £0.";
    }
  }

  const noteStr = rawValues.note.trim();
  if (noteStr.length > 1000) {
    errors.note = "Note must be 1000 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "invalid",
      errors,
      values: rawValues,
    };
  }

  const createdByEmail = organiserEmail.length > 0 ? organiserEmail : mumEmail;
  const expiryDate = expiryDateFor(closeDate);
  const baseSlug = slugBase(mumFirstName, dueDate);

  const db = getDb();
  let slug = baseSlug;
  let created = false;

  for (let attempt = 1; attempt <= 5; attempt++) {
    if (attempt > 1) {
      slug = `${baseSlug}-${randomSuffix(4)}`;
    }

    const goalText =
      goalPence !== null ? `Goal: ${formatPence(goalPence)}\n` : "";
    const emailBody = [
      `Hi ${mumFirstName},`,
      "",
      "Your TPS gift fund is live!",
      "",
      `Public fund page: /fund/${slug}`,
      `Manage your fund: /fund/${slug}/me`,
      "",
      `Close date: ${closeDate}`,
      `Credit expiry date: ${expiryDate}`,
      goalText ? goalText.trim() : null,
      "",
      "Contributions to your fund become TPS gift credit for postpartum support services.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    try {
      await db.batch([
        db.insert(funds).values({
          slug,
          mumFirstName,
          mumEmail,
          createdByEmail,
          dueDate,
          closeDate,
          goalPence,
          note: noteStr.length > 0 ? noteStr : null,
        }),
        db.insert(outbox).values({
          to: mumEmail,
          subject: "Your TPS gift fund is live",
          body: emailBody,
        }),
      ]);
      created = true;
      break;
    } catch (error) {
      if (isSlugUniqueViolation(error) && attempt < 5) {
        continue;
      }
      console.error("Failed to create fund:", error);
      return {
        status: "error",
        message: "Unable to create your fund right now. Please try again.",
        values: rawValues,
      };
    }
  }

  if (!created) {
    return {
      status: "error",
      message:
        "Unable to generate a unique link for your fund. Please try again.",
      values: rawValues,
    };
  }

  return {
    status: "created",
    slug,
    mumFirstName,
    closeDate,
    expiryDate,
  };
}
