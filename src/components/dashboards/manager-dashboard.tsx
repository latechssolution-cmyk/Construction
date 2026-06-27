"use client";

import { formatDate, getStatusColor, getProjectProgress } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, FolderOpen } from "lucide-react";
import Link from "next/link";

export function ManagerDashboard({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-500 text-sm">Overview of your assigned projects</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "My Projects", value: data.myProjects?.length ?? 0, icon: FolderOpen, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Upcoming Tasks", value: data.upcomingTasks?.length ?? 0, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Low Stock Items", value: data.lowStock?.length ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          { label: "Recent Updates", value: data.recentTasks?.length ?? 0, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <div className={`${s.bg} p-2 rounded-lg`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.myProjects?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects assigned</p>
            ) : (
              data.myProjects?.map((p: any) => {
                const progress = getProjectProgress(p.tasks ?? []);
                return (
                  <div key={p.id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <Link href={`/projects/${p.id}`} className="text-sm font-medium hover:text-blue-600">{p.name}</Link>
                      <Badge className={getStatusColor(p.status)} variant="secondary">{p.status}</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Upcoming Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Tasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.upcomingTasks?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming tasks</p>
            ) : (
              data.upcomingTasks?.map((task: any) => (
                <div key={task.id} className="flex items-start justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.project?.name} · Due {formatDate(task.dueDate)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{task.phase}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Low Stock */}
        {(data.lowStock?.length ?? 0) > 0 && (
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-4 h-4" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.lowStock?.map((m: any) => {
                const stock = Number(m.quantityReceived) - Number(m.quantityUsed);
                return (
                  <div key={m.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                    <span className="font-medium">{m.itemName}</span>
                    <span className="text-orange-600 font-bold">{stock} {m.unit} left</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
