import { ClaimPageClient } from "./client";

export default function ClaimPage({ params }: { params: { vaultId: string } }) {
  return <ClaimPageClient vaultId={params.vaultId} />;
}
