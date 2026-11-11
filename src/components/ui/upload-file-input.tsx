"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { track } from "@/lib/analytics";

interface UploadFileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Where the picker lives, reported as `source` (e.g. `home_upload_row`). */
  uploadSource: string;
  uploadMethod?: "picker" | "camera";
}

/**
 * Hidden `<input type="file">` that reports `upload_picker_opened` and
 * `upload_picker_cancelled`. React doesn't bind `onCancel` on inputs, so the
 * native `cancel` event is attached directly.
 */
export const UploadFileInput = forwardRef<HTMLInputElement, UploadFileInputProps>(
  ({ uploadSource, uploadMethod = "picker", onClick, ...props }, ref) => {
    const inner = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inner.current as HTMLInputElement);

    useEffect(() => {
      const input = inner.current;
      if (!input) return;
      const onCancel = () =>
        track("upload_picker_cancelled", {
          source: uploadSource,
          method: uploadMethod,
        });
      input.addEventListener("cancel", onCancel);
      return () => input.removeEventListener("cancel", onCancel);
    }, [uploadSource, uploadMethod]);

    return (
      <input
        ref={inner}
        type="file"
        onClick={(e) => {
          track("upload_picker_opened", {
            source: uploadSource,
            method: uploadMethod,
          });
          onClick?.(e);
        }}
        {...props}
      />
    );
  },
);
UploadFileInput.displayName = "UploadFileInput";
