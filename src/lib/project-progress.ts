import Project from "@/models/Project";
import Task from "@/models/Task";

// Single source of truth for a project's completion percentage: a
// weighted average over its tasks (weight defaults to 1 when unset).
// Call this after any task create/update/delete so Project.completionPercent
// never drifts from the tasks that actually determine it — there is no
// manual override path anymore.
export async function recomputeProjectCompletion(projectId: unknown): Promise<number> {
  if (!projectId) return 0;
  const tasks = await Task.find({ projectId }, { status: 1, weight: 1 });
  const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 1), 0);
  const completedWeight = tasks
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + (t.weight || 1), 0);
  const pct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
  await Project.findByIdAndUpdate(projectId, { completionPercent: pct });
  return pct;
}
