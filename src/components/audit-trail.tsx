"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Props {
  entity: string;   // e.g. "Vendor", "Project"
  entityId: string;
  createdAt?: string | Date;
}

export function AuditTrail({ entity, entityId, createdAt }: Props) {
  const { data } = useSWR(
    entityId ? `/api/audit?entity=${entity}&entityId=${entityId}&take=1` : null,
    fetcher
  );

  const log = Array.isArray(data) ? data[0] : null;

  if (log) {
    return (
      <p className="text-xs text-gray-400 mt-1">
        Last updated by <span className="font-medium text-gray-500">{log.user?.name || "System"}</span>
        {" "}on {new Date(log.createdAt).toLocaleDateString("en-PK", { year:"numeric", month:"short", day:"numeric" })}
        {" "}at {new Date(log.createdAt).toLocaleTimeString("en-PK", { hour:"2-digit", minute:"2-digit" })}
      </p>
    );
  }

  if (createdAt) {
    return (
      <p className="text-xs text-gray-400 mt-1">
        Created on {new Date(createdAt).toLocaleDateString("en-PK", { year:"numeric", month:"short", day:"numeric" })}
      </p>
    );
  }

  return null;
}
