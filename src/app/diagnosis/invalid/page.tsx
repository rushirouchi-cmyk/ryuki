import { EmptyState } from "@/components/ui";

export default function InvalidQrPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <EmptyState
        title="このQRコードは利用できません"
        description="有効期限が切れているか、コードが無効です。お手数ですが、案内スタッフにお声がけください。"
      />
    </main>
  );
}
