"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Rocket, Shield, ArrowLeft, Package, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { agentTemplates, AgentTemplate } from "@/lib/agent-templates";

export default function NewProjectPage() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = agentTemplates.find((t) => t.id === templateId);
    if (template) {
      setSystemPrompt(template.systemPrompt);
    }
  };

  const handleDeploy = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDeploying(true);
    // Simular tiempo de despliegue
    setTimeout(() => {
      setIsDeploying(false);
      alert("¡Despliegue simulado con éxito! Se comunicó con Supabase, n8n y WAHA.");
    }, 3000);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar minimalista */}
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 flex items-center px-8 border-b border-border/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-semibold">Desplegar Nuevo Agente IA</h1>
        </header>

        <div className="p-8 max-w-4xl mx-auto">
          <form onSubmit={handleDeploy}>
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="general">1. Datos Generales</TabsTrigger>
                <TabsTrigger value="persona">2. Personalidad</TabsTrigger>
                <TabsTrigger value="catalog">3. Catálogo (Opcional)</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-6">
                <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Información del Cliente</CardTitle>
                    <CardDescription>Define los datos básicos del negocio que usará el agente.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="project_name">Nombre del Negocio</Label>
                      <Input id="project_name" placeholder="Ej: Perfumería Elegance" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="industry">Rubro / Categoría (Selecciona de las 32 plantillas)</Label>
                      <Select required value={selectedTemplateId} onValueChange={handleTemplateChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rubro" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {agentTemplates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.category} - {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Al seleccionar un rubro, se autocompletará el Prompt Base en la siguiente pestaña usando un tono amigable argentino (estilo Sofi).
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="persona" className="space-y-6">
                <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Personalidad del Agente</CardTitle>
                    <CardDescription>Instrucciones de comportamiento (Prompt Base) para Gemini.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="persona">Instrucciones Base (System Prompt)</Label>
                      <textarea 
                        id="persona" 
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Eres un vendedor experto y amable..."
                        required
                      ></textarea>
                      <p className="text-xs text-muted-foreground">
                        Puedes editar libremente este texto para darle más contexto específico de tu cliente.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="catalog" className="space-y-6">
                <Card className="bg-card/40 border-border/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Catálogo de Productos Inicial</CardTitle>
                    <CardDescription>Carga algunos productos de prueba. Podrás importar más por Excel luego.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 border-2 border-dashed border-border/50 rounded-lg">
                      <Package className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">La tabla dinámica de carga masiva se habilitará una vez desplegado el agente.</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <div className="mt-8 flex justify-end">
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full sm:w-auto shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isDeploying}
                >
                  {isDeploying ? (
                    <span className="animate-pulse flex items-center">
                      <Bot className="w-5 h-5 mr-2 animate-spin" />
                      Creando Agente en n8n...
                    </span>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5 mr-2" />
                      Crear Agente y Conectar n8n
                    </>
                  )}
                </Button>
              </div>
            </Tabs>
          </form>

        </div>
      </main>
    </div>
  );
}
