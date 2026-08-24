"use client";

import { useActionState } from "react";
import { Button, Card, ErrorText, Field, Input, Select } from "@/components/ui";
import { registerLeadAction, type ActionState } from "../actions";

export function RegisterForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    registerLeadAction.bind(null, token),
    {},
  );

  const thisYear = new Date().getFullYear();

  return (
    <main className="px-5 pb-16 pt-8">
      <h1 className="text-2xl font-bold text-ink-900">
        より詳しいキャリア診断を
        <br />
        受け取る
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        キャリアアドバイザーによる面談で、あなたの経験に合う求人と、年収を上げるための具体的な進め方をご案内します。
      </p>

      <Card className="mt-6">
        <form action={action} className="space-y-4">
          <Field label="お名前" required>
            <Input name="fullName" autoComplete="name" required maxLength={60} />
          </Field>
          <Field label="お名前（カナ）">
            <Input name="fullNameKana" autoComplete="off" maxLength={60} />
          </Field>
          <Field label="メールアドレス" required>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="電話番号" hint="面談日程のご連絡に使用します">
            <Input name="phone" type="tel" autoComplete="tel" inputMode="tel" />
          </Field>
          <Field label="生年">
            <Select name="birthYear" defaultValue="">
              <option value="">選択してください</option>
              {Array.from({ length: 45 }, (_, index) => thisYear - 18 - index).map(
                (year) => (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                ),
              )}
            </Select>
          </Field>
          <Field label="連絡方法の希望">
            <Select name="preferredContact" defaultValue="email">
              <option value="email">メール</option>
              <option value="phone">電話</option>
            </Select>
          </Field>

          <ErrorText>{state.error}</ErrorText>

          <Button type="submit" size="lg" full disabled={pending}>
            {pending ? "送信中…" : "登録して面談予約へ進む"}
          </Button>
          <p className="text-center text-xs leading-relaxed text-ink-500">
            登録内容は、キャリア面談のご案内および、あなたが選択したエージェントへの紹介にのみ使用します。
            エージェントへの情報提供は、次の画面であなたが同意した場合にのみ行われます。
          </p>
        </form>
      </Card>
    </main>
  );
}
