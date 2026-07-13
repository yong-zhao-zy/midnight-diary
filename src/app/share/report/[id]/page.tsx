"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ReportRow, ReportContent } from "@/lib/narrative-report-service";
import { ReportDetailView } from "@/components/narrative-report/ReportDetailView";

export default function SharedReportPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("reports")
          .select("*")
          .eq("id", reportId)
          .eq("is_public", true)
          .eq("is_deleted", false)
          .single();

        if (fetchError || !data) {
          setError("这份报告不存在或已取消分享");
          return;
        }

        setReport(data as ReportRow);
      } catch {
        setError("加载失败，请稍后再试");
      } finally {
        setLoading(false);
      }
    }

    if (reportId) loadReport();
  }, [reportId]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-midnight">
        <Loader2 className="h-6 w-6 animate-spin text-glow-gold/60" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-midnight px-6 space-y-6">
        <p className="text-sm text-muted/60 text-center">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-2.5 rounded-full bg-glow-gold/90 text-midnight text-sm font-medium hover:bg-glow-gold transition-colors"
        >
          写下我的深夜回响
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-midnight">
      <ReportDetailView
        report={report}
        onClose={() => {}}
        readOnly
      />

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="fixed bottom-8 left-0 right-0 flex justify-center z-60 px-6"
      >
        <button
          onClick={() => router.push("/login")}
          className="px-6 py-3 rounded-full bg-glow-gold/90 text-midnight text-sm font-medium hover:bg-glow-gold transition-all shadow-[0_0_24px_-4px_rgba(253,230,138,0.3)]"
        >
          写下我的深夜回响
        </button>
      </motion.div>
    </div>
  );
}
