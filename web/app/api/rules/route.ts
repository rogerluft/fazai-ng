import { NextResponse, NextRequest } from "next/server";
import { qdrant, upsertPoint, deletePoint } from "@/lib/qdrant";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 100);
    const enabled = searchParams.get("enabled");

    // Build filter
    const must: any[] = [];
    if (enabled !== null) {
      must.push({ key: "enabled", match: { value: enabled === "true" } });
    }

    // Query Qdrant
    const response = await qdrant.scroll("fazai_inference", {
      filter: must.length > 0 ? { must } : undefined,
      limit,
      with_payload: true,
      with_vector: false,
    });

    const rules = response.points.map((point) => ({
      id: point.id,
      rule_id: point.payload?.rule_id,
      title: point.payload?.title,
      description: point.payload?.description,
      condition: point.payload?.condition,
      action: point.payload?.action,
      priority: point.payload?.priority,
      enabled: point.payload?.enabled,
      created_by: point.payload?.created_by,
      created_at: point.payload?.created_at,
      last_applied: point.payload?.last_applied,
      apply_count: point.payload?.apply_count,
      tags: point.payload?.tags,
    }));

    return NextResponse.json({
      rules: rules.length > 0 ? rules : [],
      total: rules.length,
    });
  } catch (error: any) {
    console.error("Failed to fetch rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch rules", details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      rule_id,
      title,
      description,
      condition,
      action,
      priority,
      enabled,
      tags,
    } = body;

    if (!rule_id || !title || !condition || !action) {
      return NextResponse.json(
        {
          error: "Missing required fields: rule_id, title, condition, action",
        },
        { status: 400 }
      );
    }

    // Generate ID from rule_id hash
    const id = Math.abs(
      rule_id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)
    );

    await upsertPoint("fazai_inference", id, {
      rule_id,
      title,
      description,
      condition,
      action,
      priority: priority || 5,
      enabled: enabled ?? true,
      created_by: "user",
      created_at: new Date().toISOString(),
      apply_count: 0,
      tags,
    });

    return NextResponse.json({
      success: true,
      rule: {
        id,
        rule_id,
        title,
        description,
        priority,
        enabled,
      },
    });
  } catch (error: any) {
    console.error("Failed to create rule:", error);
    return NextResponse.json(
      { error: "Failed to create rule", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rule_id = searchParams.get("rule_id");

    if (!rule_id) {
      return NextResponse.json(
        { error: "Missing rule_id parameter" },
        { status: 400 }
      );
    }

    const id = Math.abs(
      rule_id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)
    );

    await deletePoint("fazai_inference", id);

    return NextResponse.json({ success: true, rule_id });
  } catch (error: any) {
    console.error("Failed to delete rule:", error);
    return NextResponse.json(
      { error: "Failed to delete rule", details: error.message },
      { status: 500 }
    );
  }
}
