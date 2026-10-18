import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { UserMenu } from "@/components/ui/user-menu";
import { requirePerson } from "@/lib/auth";

export default async function ReviewQueue() {
  const person = await requirePerson();
  return (
    <>
      <TopBar crumb={[{ label: "Review queue" }]} right={<UserMenu person={person} />} />
      <Page className="py-8"><Empty title="Nothing waiting for review" hint="Tasks appear here when an artist submits a version." /></Page>
    </>
  );
}
