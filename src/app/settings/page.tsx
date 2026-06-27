import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Save, Server, Shield, Key } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - Se podría extraer a un componente en el futuro */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <Bot className="w-6 h-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">AgentFlow BaaS</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground">
              Dashboard
            </Button>
          </Link>
          <Button variant="secondary" className="w-full justify-start">
            <Shield className="w-4 h-4 mr-2" />
            Configuración Global
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 flex items-center px-8 border-b border-border/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-semibold">Configuración de Integraciones</h1>
        </header>

        <div className="p-8 max-w-4xl mx-auto space-y-8">
          
          <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-lg flex items-start space-x-3">
            <Shield className="w-5 h-5 mt-0.5" />
            <div>
              <h3 className="font-medium">Almacenamiento Seguro</h3>
              <p className="text-sm opacity-90 mt-1">
                Tus credenciales se cifran antes de guardarse en la base de datos usando Supabase Vault. 
                Nunca serán expuestas ni retornadas al cliente (frontend).
              </p>
            </div>
          </div>

          <form className="space-y-6">
            {/* n8n Configuration */}
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Server className="w-5 h-5 text-purple-500" />
                  <CardTitle>Servidor n8n (Orquestador Lógico)</CardTitle>
                </div>
                <CardDescription>Conecta tu instancia de n8n para la generación automática de workflows.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="n8n_url">URL del Servidor</Label>
                  <Input id="n8n_url" placeholder="https://tu-instancia-n8n.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="n8n_key">API Key de n8n</Label>
                  <Input id="n8n_key" type="password" placeholder="••••••••••••••••••••••••" />
                </div>
              </CardContent>
            </Card>

            {/* WAHA Configuration */}
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-green-500" />
                  <CardTitle>WAHA (WhatsApp HTTP API)</CardTitle>
                </div>
                <CardDescription>Credenciales para iniciar sesiones y enviar mensajes por WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="waha_url">URL del Servidor WAHA</Label>
                  <Input id="waha_url" placeholder="https://tu-waha.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="waha_key">API Key de WAHA (Opcional)</Label>
                  <Input id="waha_key" type="password" placeholder="••••••••••••••••••••••••" />
                </div>
              </CardContent>
            </Card>

            {/* Resend Configuration */}
            <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Key className="w-5 h-5 text-red-500" />
                  <CardTitle>Resend (Notificaciones)</CardTitle>
                </div>
                <CardDescription>Para notificaciones de caídas o solicitudes de atención humana.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="resend_key">API Key de Resend</Label>
                  <Input id="resend_key" type="password" placeholder="re_••••••••••••••••••••••••" />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button size="lg" className="w-full sm:w-auto shadow-md">
                <Save className="w-4 h-4 mr-2" />
                Guardar Configuración Segura
              </Button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
}
