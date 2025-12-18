import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

type ToastVariant = "default" | "destructive";

interface ToastOptions {
  title?: string;
  description: string;
  duration?: number;
}

/**
 * Show a success toast notification
 */
export function showSuccess(options: ToastOptions | string) {
  const opts = typeof options === "string" ? { description: options } : options;
  return toast({
    title: opts.title || "Success",
    description: opts.description,
    variant: "default" as ToastVariant,
  });
}

/**
 * Show an error toast notification
 */
export function showError(options: ToastOptions | string) {
  const opts = typeof options === "string" ? { description: options } : options;
  return toast({
    title: opts.title || "Error",
    description: opts.description,
    variant: "destructive" as ToastVariant,
  });
}

/**
 * Show a warning toast notification
 */
export function showWarning(options: ToastOptions | string) {
  const opts = typeof options === "string" ? { description: options } : options;
  return toast({
    title: opts.title || "Warning",
    description: opts.description,
    variant: "default" as ToastVariant,
  });
}

/**
 * Show an info toast notification
 */
export function showInfo(options: ToastOptions | string) {
  const opts = typeof options === "string" ? { description: options } : options;
  return toast({
    title: opts.title || "Info",
    description: opts.description,
    variant: "default" as ToastVariant,
  });
}

/**
 * Show a loading toast that can be updated
 */
export function showLoading(description: string) {
  return toast({
    title: "Loading",
    description,
    variant: "default" as ToastVariant,
  });
}
