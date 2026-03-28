import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helper";
import { deleteCategory, updateCategory } from "@/lib/category";

// PATCH /api/categories/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const categoryId = Number(id);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }

    const body = await request.json();
    await updateCategory(categoryId, {
      name: typeof body?.name === "string" ? body.name.trim() : undefined,
      color: typeof body?.color === "string" ? body.color : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to update category:", error);
    if (error?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/categories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const categoryId = Number(id);
    if (!Number.isFinite(categoryId) || categoryId <= 0) {
      return NextResponse.json({ error: "Invalid category id" }, { status: 400 });
    }

    await deleteCategory(categoryId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
