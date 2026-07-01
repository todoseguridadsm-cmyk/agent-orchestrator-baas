import { createClient } from "@/lib/supabase/server";
import { getCurrentAgency } from "@/app/actions";
import { redirect } from "next/navigation";
import { Bot, ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import SettingsForm from "./settings-form";
import ResyncAgentsCard from "./resync-card";

export default async function SettingsPage() {
  const agency = await getCurrentAgency();
  if (!agency) redirect("/login");
  if (agency.role !== "superadmin") redirect("/projects");

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("agency_settings")
    .select("*")
    .eq("agency_id", agency.id)
    .single();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Bot className="w-6 h-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">Ajustes</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {agency.role === "superadmin" ? (
            <Link href="/admin/agencies">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Clientes
              </Button>
            </Link>
          ) : (
            <Link href="/projects">
              <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a mis Bots
              </Button>
            </Link>
          )}
          
          <Button variant="secondary" className="w-full justify-start">
            <Settings className="w-4 h-4 mr-2" />
            Configuración API
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 flex items-center px-8 border-b border-border/50 backdrop-blur-sm sticky top-0 z-10 bg-background/80">
          <h1 className="text-xl font-semibold">Configuración Global de la Agencia</h1>
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-8">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Settings className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Conexiones de Servidor</h2>
              <p className="text-muted-foreground">
                Configura los servidores de n8n y WAHA para que el sistema pueda orquestar agentes en tu infraestructura.
              </p>
            </div>
          </div>

          <SettingsForm initialData={settings || {}} />

          {/* Backup / Disaster Recovery */}
          <ResyncAgentsCard />
        </div>
      </main>
    </div>
  );
}
