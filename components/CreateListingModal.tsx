"use client";

import { useRef } from "react";
import { Modal, type ModalHandle } from "@/components/Modal";
import {
  CreateListingForm,
  type CreateListingState,
} from "@/components/CreateListingForm";

export function CreateListingModal({
  triggerLabel,
  initialType,
  action,
}: {
  triggerLabel: string;
  initialType: "salon" | "shop" | "both";
  action: (
    prevState: CreateListingState,
    formData: FormData
  ) => Promise<CreateListingState>;
}) {
  const modalRef = useRef<ModalHandle>(null);

  return (
    <Modal ref={modalRef} triggerLabel={triggerLabel} title="Create your listing">
      <CreateListingForm
        action={action}
        initialType={initialType}
        onSuccess={() => modalRef.current?.close()}
      />
    </Modal>
  );
}
