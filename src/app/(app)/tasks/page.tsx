import { Suspense } from "react";

import { TasksBoard } from "@/components/task/TasksBoard";
import { PageLoader } from "@/components/shell/PageLoader";

export default function TasksPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading tasks…" />}>
      <TasksBoard />
    </Suspense>
  );
}
