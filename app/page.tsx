import { TopBar } from "@/components/ui/topbar";
import { Page } from "@/components/ui/panel";
import { Empty } from "@/components/ui/empty";

export default function Home() {
  return (
    <>
      <TopBar crumb={[{ label: "Projects" }]} />
      <Page className="py-8">
        <Empty title="No projects yet" hint="Production creates the first project from Setup." />
      </Page>
    </>
  );
}
