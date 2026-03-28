import { type NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess } from "@/lib/access";
import { createCategory, getCategoriesByOwner } from "@/lib/category";

// GET /api/categories?owner_type=team&owner_id=1
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ownerType = searchParams.get("owner_type") as "team" | "personal";
    const ownerId = searchParams.get("owner_id");

    if (!ownerType || !ownerId) {
      return NextResponse.json(
        { error: "owner_type and owner_id are required" },
        { status: 400 },
      );
    }
    if (ownerType !== "team" && ownerType !== "personal") {
      return NextResponse.json(
        { error: "owner_type must be 'team' or 'personal'" },
        { status: 400 },
      );
    }

    const access = await requireOwnerAccess(request, ownerType, Number(ownerId));
    if (access instanceof NextResponse) return access;

    const categories = await getCategoriesByOwner(ownerType, Number(ownerId));
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, color, owner_type, owner_id } = body;

    if (!name || !owner_type || !owner_id) {
      return NextResponse.json(
        { error: "name, owner_type, and owner_id are required" },
        { status: 400 },
      );
    }
    if (owner_type !== "team" && owner_type !== "personal") {
      return NextResponse.json(
        { error: "owner_type must be 'team' or 'personal'" },
        { status: 400 },
      );
    }

    const access = await requireOwnerAccess(
      request,
      owner_type,
      Number(owner_id),
    );
    if (access instanceof NextResponse) return access;

    const categoryId = await createCategory({
      name: String(name).trim(),
      color: color || "#3B82F6",
      owner_type,
      owner_id: Number(owner_id),
      member_id: access.user.memberId,
    });
    return NextResponse.json({ category_id: categoryId }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create category:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
