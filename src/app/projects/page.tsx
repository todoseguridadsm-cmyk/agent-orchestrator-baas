import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, Plus, Rocket, Trash2, Power, PowerOff, ArrowLeft, Settings, Palette } from "lucide-react";
import Link from "next/link";
import { getCurrentAgency, deleteProject } from "../actions";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const agency = await getCurrentAgency();

  if (!agency) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  const t = await getDictionary();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar minimalista */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          {agency.white_label_logo ? (
            <img src={agency.white_label_logo} alt="Logo" className="w-8 h-8 rounded-md mr-3 object-cover" />
          ) : (
            <Bot className="w-6 h-6 text-primary mr-2" />
          )}
          <span className="font-bold text-lg tracking-tight truncate" title={agency.white_label_name || "Panel Admin"}>
            {agency.white_label_name || "Panel Admin"}
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t.developer_panel.back_to_bot}
            </Button>
          </Link>
          {agency.role === "superadmin" && (
            <Link href="/settings">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <Settings className="w-4 h-4 mr-2" />
                {t.developer_panel.agency_settings}
              </Button>
            </Link>
          )}
          
          {(agency.subscription_plan === "pro" || agency.subscription_plan === "agency_master" || agency.role === "superadmin") && (
            <Link href="/projects/whitelabel">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <Palette className="w-4 h-4 mr-2" />
                Marca Blanca
              </Button>
            </Link>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 flex items-center justify-between px-8 border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
          <div>
            <h1 className="text-xl font-semibold">{t.developer_panel.title}</h1>
            <p className="text-xs text-muted-foreground">{t.developer_panel.subtitle}</p>
          </div>
          <Link href="/projects/new">
            <Button className="shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              {t.workspace.create_new}
            </Button>
          </Link>
        </header>

        <div className="p-8 max-w-5xl mx-auto space-y-8">
          
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.developer_panel.table_name}</TableHead>
                  <TableHead>{t.developer_panel.table_industry}</TableHead>
                  <TableHead>{t.developer_panel.table_status}</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects && projects.length > 0 ? (
                  projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link href={`/projects/${p.id}`} className="hover:underline flex items-center">
                          <Bot className="w-4 h-4 mr-2 text-primary" />
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell>{p.industry}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-500">
                          {p.waha_status === 'PENDING_QR' ? 'Falta Escanear QR' : p.waha_status}
                        </span>
                      </TableCell>
                      <TableCell className="flex space-x-2">
                        <Link href={`/projects/${p.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            {t.developer_panel.manage}
                          </Button>
                        </Link>
                        <form action={deleteProject as any}>
                          <input type="hidden" name="projectId" value={p.id} />
                          <Button variant="outline" size="sm" type="submit" className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                      {t.developer_panel.no_agents}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </main>
    </div>
  );
}
