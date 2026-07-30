import { NextResponse } from "next/server";

/** Legacy endpoint — use POST /api/signup */
export async function POST() {
  return NextResponse.json(
    { error: "Use /api/signup to create an account and organization" },
    { status: 410 },
  );
}
