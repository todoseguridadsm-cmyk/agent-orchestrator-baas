import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Bot className="w-6 h-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">AgentFlow BaaS</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          </Link>
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-16 flex items-center justify-between px-8 border-b border-border/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-semibold">Tus Proyectos (Bots)</h1>
          <Link href="/projects/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Agente
            </Button>
          </Link>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm">
            <CardHeader>
              <CardTitle>Listado de Bots Activos</CardTitle>
              <CardDescription>
                Aquí aparecerán todos los agentes que hayas desplegado para tus clientes. (Conectado a Supabase próximamente).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-lg">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="text-lg font-medium">Aún no hay bots creados</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Crea tu primer agente para empezar a automatizar la atención.
                </p>
                <Link href="/projects/new">
                  <Button variant="outline">Crear el primer Agente</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
