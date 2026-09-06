"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { getAdminAccess } from "@/lib/actions/admin";
import { adminCopy } from "@/lib/admin/copy";
import { buttonClassName } from "@/components/ui/button";

export function AdminLink() {
  const locale = useLocale();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    void getAdminAccess().then((access) => { if (active) setAllowed(access); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!allowed) return null;
  return <Link href={`/${locale}/admin`} prefetch={false} className={buttonClassName({ variant: "secondary" })}>
    {adminCopy(locale).link}
  </Link>;
}
