import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalContact,
  LegalDocument,
  LegalSection,
} from "@/components/legal/legal-document";
import { legal } from "@/config/legal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  return locale === "en"
    ? {
        title: "Terms of Service | beanmap",
        description: "Terms for using beanmap and its coffee journal features",
      }
    : {
        title: "이용약관 | beanmap",
        description: "beanmap 서비스 이용약관",
      };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "en" ? "en" : "ko";

  return locale === "ko" ? <KoreanTerms /> : <EnglishTerms />;
}

function KoreanTerms() {
  return (
    <LegalDocument
      locale="ko"
      title="서비스 이용약관"
      description="beanmap을 편안하게 이용하는 데 필요한 최소한의 기준을 정했습니다. 중요한 내용은 계정, 기록의 소유권, 서비스 변경과 탈퇴에 관한 사항입니다."
      effectiveDate={legal.effectiveDate}
    >
      <LegalSection title="1. 약관의 목적과 적용">
        <p>이 약관은 {legal.operatorName}(이하 “운영자”)가 제공하는 beanmap과 관련 서비스의 이용 조건, 이용자와 운영자의 권리·의무를 정합니다. 이용자가 회원가입 절차에서 동의하면 약관이 적용됩니다.</p>
      </LegalSection>

      <LegalSection title="2. 가입과 계정">
        <ul className="list-disc space-y-1 pl-5">
          <li>만 14세 이상인 사람만 가입할 수 있습니다.</li>
          <li>정확한 정보를 사용하고 계정 접근수단을 안전하게 관리해야 합니다.</li>
          <li>다른 사람의 계정을 사용하거나 계정을 양도해서는 안 됩니다.</li>
          <li>Google·카카오 로그인 이용 시 해당 제공자의 조건도 함께 적용될 수 있습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 서비스와 이용자 기록">
        <p>beanmap은 커피 기록의 저장·조회·수정·삭제, 통계, 데이터 내보내기와 산지 정보를 제공합니다. 이용자가 작성한 기록의 권리는 이용자에게 남습니다. 운영자는 서비스를 제공하고 보안을 유지하는 데 필요한 범위에서만 기록을 처리합니다.</p>
        <p>산지와 향미 정보는 일반적인 참고 자료이며 특정 원두의 품질, 맛, 구매 결과를 보증하지 않습니다.</p>
      </LegalSection>

      <LegalSection title="4. 금지되는 이용">
        <p>법령 또는 다른 사람의 권리를 침해하는 행위, 서비스나 계정에 대한 무단 접근, 자동화된 대량 요청, 악성코드 전송, 서비스 운영 방해, 권한 없이 제3자의 개인정보를 기록하는 행위를 해서는 안 됩니다.</p>
      </LegalSection>

      <LegalSection title="5. 서비스의 변경과 중단">
        <p>운영자는 기능 개선, 보안, 점검 또는 불가피한 기술적 사유로 서비스를 변경하거나 일시 중단할 수 있습니다. 이용자에게 중요한 변경이나 예측 가능한 장기 중단은 가능한 범위에서 미리 알립니다. 무료로 제공되는 기능은 합리적인 사유가 있으면 종료될 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="6. 계정 이용 제한과 탈퇴">
        <p>이용자는 언제든지 설정에서 탈퇴할 수 있습니다. 약관이나 법령을 중대하게 위반하거나 서비스 보안을 위협하는 경우 운영자는 사전 통지 후 이용을 제한할 수 있습니다. 긴급한 보안 위험이 있으면 먼저 제한하고 이후 사유를 알릴 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="7. 책임의 범위">
        <p>운영자는 고의 또는 과실로 이용자에게 손해를 입힌 경우 관계 법령에 따라 책임을 부담합니다. 다만 이용자의 귀책사유, 통제하기 어려운 통신·인프라 장애, 천재지변 등 운영자가 합리적으로 통제할 수 없는 사유로 생긴 손해에는 책임을 부담하지 않습니다. 이 조항은 법률상 배제할 수 없는 이용자의 권리를 제한하지 않습니다.</p>
      </LegalSection>

      <LegalSection title="8. 개인정보 보호">
        <p>개인정보 처리에 관한 자세한 내용은 <Link className="font-medium text-accent underline underline-offset-4" href="/ko/privacy">개인정보 처리방침</Link>에서 확인할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="9. 약관 변경">
        <p>약관이 변경되면 시행일과 변경 이유를 서비스에 게시합니다. 이용자에게 불리한 중요한 변경은 최소 30일 전에 알립니다. 이용자가 변경 약관에 동의하지 않으면 시행 전까지 탈퇴할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="10. 준거법과 분쟁 해결">
        <p>대한민국 법을 준거법으로 합니다. 분쟁이 생기면 먼저 성실히 협의하고, 해결되지 않으면 대한민국 민사소송법에서 정한 관할 법원에 제기할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="11. 문의">
        <LegalContact locale="ko" operatorName={legal.operatorName} contactEmail={legal.contactEmail} />
      </LegalSection>
    </LegalDocument>
  );
}

function EnglishTerms() {
  return (
    <LegalDocument
      locale="en"
      title="Terms of Service"
      description="These terms set the minimum rules for using beanmap, including accounts, ownership of your journal, service changes, and account deletion."
      effectiveDate={legal.effectiveDate}
    >
      <LegalSection title="1. Scope and eligibility">
        <p>These terms govern beanmap and related services provided by {legal.operatorNameEn}. You must be at least 14 years old, provide accurate account information, and keep your sign-in credentials secure.</p>
      </LegalSection>

      <LegalSection title="2. Service and your content">
        <p>beanmap provides coffee journal, statistics, export, and origin-reference features. You retain your rights in records you create. We process them only as needed to provide and secure the service. Origin and flavor material is general reference information and does not guarantee a particular bean’s quality, taste, or purchase outcome.</p>
      </LegalSection>

      <LegalSection title="3. Acceptable use">
        <p>Do not violate law or third-party rights, access accounts or systems without authorization, send automated bulk requests or malware, disrupt the service, transfer accounts, or enter another person’s information without authority.</p>
      </LegalSection>

      <LegalSection title="4. Changes, suspension, and termination">
        <p>We may change or temporarily suspend the service for improvement, security, maintenance, or unavoidable technical reasons. We will give advance notice where reasonably possible for material changes or planned extended interruptions. You may delete your account in Settings at any time.</p>
      </LegalSection>

      <LegalSection title="5. Responsibility">
        <p>We are responsible for harm caused by our intent or negligence as required by law. We are not responsible for harm caused by your actions or events reasonably outside our control, such as third-party network failures or natural disasters. Nothing here limits rights that cannot legally be excluded.</p>
      </LegalSection>

      <LegalSection title="6. Privacy and changes to these terms">
        <p>See our <Link className="font-medium text-accent underline underline-offset-4" href="/en/privacy">Privacy Policy</Link>. We will post the effective date and reason before changing these terms, and announce material changes adverse to users at least 30 days in advance.</p>
      </LegalSection>

      <LegalSection title="7. Governing law and contact">
        <p>Korean law governs these terms, and disputes may be brought in a court with jurisdiction under Korea’s Civil Procedure Act. If the Korean and English versions differ, the Korean version governs.</p>
        <LegalContact locale="en" operatorName={legal.operatorNameEn} contactEmail={legal.contactEmail} />
      </LegalSection>
    </LegalDocument>
  );
}
