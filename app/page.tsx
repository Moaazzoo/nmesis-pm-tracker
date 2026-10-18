import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";
import { UserMenu } from "@/components/ui/user-menu";
import { requirePerson } from "@/lib/auth";

export default async function Home() {
  const person = await requirePerson();
  return (
    <>
      <TopBar crumb={[{ label: "Projects" }]} right={<UserMenu person={person} />} />
      <Page className="py-8">
        <Empty title="No projects yet" hint="Production creates the first project from Setup." />
      </Page>
    </>
  );
}
