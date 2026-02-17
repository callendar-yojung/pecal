"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";

export default function AccountPage() {
  const t = useTranslations("dashboard.settings.account");
  const { data: session, update: updateSession } = useSession();
  const [nickname, setNickname] = useState(session?.user?.nickname || "");
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
    session?.user?.profileImageUrl || null
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"ok" | "taken" | "idle">("idle");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (session?.user?.nickname) {
      setNickname(session.user.nickname);
    }
    if (session?.user?.profileImageUrl !== undefined) {
      setProfileImageUrl(session.user.profileImageUrl ?? null);
    }
  }, [session?.user?.nickname, session?.user?.profileImageUrl]);

  useEffect(() => {
    setCheckResult("idle");
  }, [nickname]);

  const handleSave = async () => {
    if (!nickname.trim()) return;
    try {
      setSaving(true);
      setSaved(false);
      const response = await fetch("/api/me/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setNickname(data.nickname);
        await updateSession({ nickname: data.nickname });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const err = await response.json();
        alert(err.error || "Failed to update");
      }
    } catch (error) {
      console.error("Failed to update account:", error);
      alert("Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckNickname = async () => {
    if (!nickname.trim()) return;
    setChecking(true);
    setCheckResult("idle");
    try {
      const res = await fetch(
        `/api/me/account/nickname-check?nickname=${encodeURIComponent(nickname.trim())}`
      );
      const data = await res.json();
      if (res.ok && data?.available === true) {
        setCheckResult("ok");
      } else if (res.ok && data?.available === false) {
        setCheckResult("taken");
      } else {
        alert(data.error || "Failed to check nickname");
      }
    } catch (error) {
      console.error("Failed to check nickname:", error);
      alert("Failed to check nickname");
    } finally {
      setChecking(false);
    }
  };

  const handleProfileImageUpload = async (file: File) => {
    if (!session?.user?.memberId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("owner_type", "personal");
      formData.append("owner_id", String(session.user.memberId));

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to upload image");
        return;
      }

      const nextUrl = data?.file?.file_path as string | undefined;
      if (!nextUrl) return;

      const updateRes = await fetch("/api/me/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_image_url: nextUrl }),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        alert(updateData.error || "Failed to update profile image");
        return;
      }

      setProfileImageUrl(nextUrl);
      await updateSession({ profileImageUrl: nextUrl });
    } catch (error) {
      console.error("Failed to upload profile image:", error);
      alert("Failed to upload profile image");
    } finally {
      setUploading(false);
    }
  };

  const handleProfileImageRemove = async () => {
    try {
      const res = await fetch("/api/me/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_image_url: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to remove profile image");
        return;
      }
      setProfileImageUrl(null);
      await updateSession({ profileImageUrl: null });
    } catch (error) {
      console.error("Failed to remove profile image:", error);
      alert("Failed to remove profile image");
    }
  };

  return (
    <div className="space-y-6">
      {/* 프로필 정보 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-card-foreground">
          {t("profile")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("profileDesc")}
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-subtle-foreground">
              {t("profileImage")}
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("profileImageDesc")}
            </p>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt={nickname || "User"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-semibold text-muted-foreground">
                    {nickname?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted">
                  {uploading ? t("uploading") : t("uploadImage")}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleProfileImageUpload(file);
                    }}
                    disabled={uploading}
                  />
                </label>
                {profileImageUrl && (
                  <button
                    type="button"
                    onClick={handleProfileImageRemove}
                    className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                  >
                    {t("removeImage")}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-subtle-foreground">
              {t("name")}
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={handleCheckNickname}
                disabled={checking || !nickname.trim()}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                {checking ? t("checking") : t("checkNickname")}
              </button>
            </div>
            {checkResult === "ok" && (
              <p className="mt-1 text-xs text-green-600">{t("nicknameAvailable")}</p>
            )}
            {checkResult === "taken" && (
              <p className="mt-1 text-xs text-destructive">{t("nicknameTaken")}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-subtle-foreground">
              {t("email")}
            </label>
            <input
              type="email"
              defaultValue={session?.user?.email || ""}
              disabled
              className="mt-1 w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t("emailDesc")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "..." : t("save")}
            </button>
            {saved && (
              <span className="text-sm text-green-600 dark:text-green-400">
                Saved!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 계정 삭제 */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="text-lg font-semibold text-destructive">
          {t("deleteAccount")}
        </h2>
        <p className="mt-1 text-sm text-destructive/80">
          {t("deleteAccountDesc")}
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-destructive bg-background px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          {t("deleteButton")}
        </button>
      </div>
    </div>
  );
}
