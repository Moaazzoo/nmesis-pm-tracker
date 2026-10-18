import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { UserMenu } from "@/components/ui/user-menu";
import { requirePerson } from "@/lib/auth";

export default async function MyQueue() {
  const person = await requirePerson();
  return (
    <>
      <TopBar crumb={[{ label: "My Queue" }]} right={<UserMenu person={person} />} />
      <Page className="py-8"><Empty title="Nothing assigned to you yet" hint="Production assigns tasks from the project board." /></Page>
    </>
  );
}
