"use client";
import { FailureList } from "@/components/FailureList";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

export default function WhyIndexPage() {
  return (
    <div className="p-6 lg:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Pick a failure to investigate</CardTitle>
        </CardHeader>
        <FailureList windowHours={24 * 14} limit={50} />
      </Card>
    </div>
  );
}
