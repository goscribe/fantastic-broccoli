"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast, toastError } from "@/lib/toast";
import {
  changeWorkspaceMemberRole,
  fetchCurrentWorkspaceRole,
  fetchPendingInvitations,
  fetchWorkspaceMembers,
  inviteMember,
  removeWorkspaceMember,
  type WorkspaceInvitationRecord,
  type WorkspaceMemberRecord,
} from "@/lib/api/workspace";
import { cn } from "@/lib/utils";
import { Trash2, X } from "lucide-react";

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

function MemberRow({
  member,
  currentRole,
  onRoleChange,
  onRemove,
  busy,
}: {
  member: WorkspaceMemberRecord;
  currentRole: "owner" | "admin" | "member" | null;
  onRoleChange: (memberId: string, role: "admin" | "member") => void;
  onRemove: (memberId: string) => void;
  busy: boolean;
}) {
  const canManage = currentRole === "owner" && member.role !== "owner" && !busy;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border p-4",
        "bg-card sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "font-semibold text-white",
            member.role === "owner" ? "bg-accent" : "bg-muted-foreground",
          )}
        >
          {member.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{member.name}</p>
          <p className="truncate text-[12px] text-muted-foreground">
            {member.email}
          </p>
          <p className="text-[11px] text-faint">
            Joined {new Date(member.joinedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold capitalize text-accent">
          {member.role}
        </span>
        {canManage && (
          <>
            <select
              aria-label={`Role for ${member.name}`}
              defaultValue={member.role}
              onChange={(e) =>
                onRoleChange(member.id, e.target.value as "admin" | "member")
              }
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-[12px] focus:border-accent focus:outline-none"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(member.id)}
              className="h-9 px-3 text-rose hover:text-rose"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function WorkspaceMembersDialog({
  workspaceId,
  open,
  onClose,
}: {
  workspaceId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberRecord[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationRecord[]>([]);
  const [currentRole, setCurrentRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const [members, pending, current] = await Promise.all([
        fetchWorkspaceMembers(workspaceId),
        fetchPendingInvitations(workspaceId),
        fetchCurrentWorkspaceRole(workspaceId),
      ]);
      setWorkspaceMembers(members);
      setInvitations(pending);
      setCurrentRole(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!open || !workspaceId) return;
    void Promise.resolve().then(load);
  }, [open, workspaceId, load]);

  const handleInvite = async () => {
    if (!workspaceId || !email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      await inviteMember(workspaceId, email.trim(), role);
      setEmail("");
      await load();
      toast.success("Invitation sent");
    } catch (err) {
      setError(toastError(err, "Failed to invite member."));
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, nextRole: "admin" | "member") => {
    if (!workspaceId) return;
    setUpdating(true);
    setError(null);
    try {
      await changeWorkspaceMemberRole(workspaceId, memberId, nextRole);
      await load();
    } catch (err) {
      setError(toastError(err, "Failed to update role."));
    } finally {
      setUpdating(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!workspaceId) return;
    setUpdating(true);
    setError(null);
    try {
      await removeWorkspaceMember(workspaceId, memberId);
      await load();
      toast.success("Member removed");
    } catch (err) {
      setError(toastError(err, "Failed to remove member."));
    } finally {
      setUpdating(false);
    }
  };

  if (!open) return null;

  const canInvite = currentRole === "owner" || currentRole === "admin";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl animate-fade-up">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <p className="text-lg font-bold tracking-tight">Members</p>
            <p className="text-[13px] text-muted-foreground">
              {workspaceMembers.length} member
              {workspaceMembers.length === 1 ? "" : "s"}
              {invitations.length > 0
                ? ` · ${invitations.length} pending invite${
                    invitations.length === 1 ? "" : "s"
                  }`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {canInvite && (
          <div className="border-b border-border px-6 pb-5">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleInvite();
                }}
                placeholder="Invite by email…"
                className="h-10 flex-1 rounded-lg border border-border bg-background px-3.5 text-sm focus:border-accent focus:outline-none"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "member")}
                aria-label="Role for invitee"
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button onClick={() => void handleInvite()} disabled={inviting || !email.trim()}>
                {inviting ? "Inviting…" : "Send invite"}
              </Button>
            </div>
          </div>
        )}

        <div className="max-h-[55vh] space-y-6 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {workspaceMembers.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  currentRole={currentRole}
                  onRoleChange={(memberId, nextRole) =>
                    void handleRoleChange(memberId, nextRole)
                  }
                  onRemove={(memberId) => void handleRemove(memberId)}
                  busy={updating}
                />
              ))}
            </div>
          )}

          {invitations.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Pending invitations
              </p>
              <div className="space-y-2">
                {invitations.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm"
                  >
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-[12px] text-muted-foreground">
                      <span className="capitalize">{invite.role}</span> · Expires{" "}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="border-t border-border px-6 py-3 text-sm text-rose">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
