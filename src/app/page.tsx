import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Plus, Settings, Users, Activity } from "lucide-react";
import Link from "next/link";
export default function Dashboard() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Bot className="w-6 h-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">AgentFlow BaaS</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <Button variant="secondary" className="w-full justify-start">
              <Activity className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </Link>
          <Link href="/projects">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <Users className="w-4 h-4 mr-2" />
              Proyectos (Bots)
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4 mr-2" />
              Configuración Global
            </Button>
          </Link>
        </nav>
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-medium text-xs">AG</span>
            </div>
            <div>
              <p className="text-sm font-medium leading-none">Agencia Demo</p>
              <p className="text-xs text-muted-foreground mt-1">Plan Pro</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 flex items-center justify-between px-8 border-b border-border/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-semibold">Resumen General</h1>
          <Link href="/projects/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Agente
            </Button>
          </Link>
        </header>

        <div className="p-8 space-y-8">
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card/40 border-border/50 shadow-sm backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Agentes Activos</CardTitle>
                <Bot className="w-4 h-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground mt-1">+2 desde el mes pasado</p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border/50 shadow-sm backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sesiones WAHA</CardTitle>
                <Activity className="w-4 h-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12 / 12</div>
                <p className="text-xs text-emerald-500 mt-1">Todas conectadas</p>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border/50 shadow-sm backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Intervenciones Humanas</CardTitle>
                <Users className="w-4 h-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4</div>
                <p className="text-xs text-muted-foreground mt-1">Requieren atención ahora</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions / Empty State */}
          <Card className="border-border/50 bg-gradient-to-br from-card/40 to-primary/5 shadow-md">
            <CardHeader>
              <CardTitle>Despliega un nuevo Agente IA</CardTitle>
              <CardDescription>
                Configura un nuevo bot de ventas o atención al cliente conectando n8n y WAHA en un clic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/projects/new">
                <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary/20">
                  <Plus className="w-5 h-5 mr-2" />
                  Iniciar Creador de Proyectos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
