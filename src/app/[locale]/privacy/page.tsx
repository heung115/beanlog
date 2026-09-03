import type { Metadata } from "next";
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
        title: "Privacy Policy | beanmap",
        description: "How beanmap processes and protects personal information",
      }
    : {
        title: "개인정보 처리방침 | beanmap",
        description: "beanmap 개인정보 처리방침",
      };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "en" ? "en" : "ko";

  return locale === "ko" ? <KoreanPrivacy /> : <EnglishPrivacy />;
}

function KoreanPrivacy() {
  return (
    <LegalDocument
      locale="ko"
      eyebrow="Privacy"
      title="개인정보 처리방침"
      description="beanmap은 커피 기록 서비스를 제공하는 데 필요한 정보만 처리합니다. 광고나 행동 추적을 위한 쿠키는 사용하지 않습니다."
      effectiveDate={legal.effectiveDate}
    >
      <LegalSection title="1. 처리하는 개인정보와 목적">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="border-y border-border text-brown">
                <th className="px-3 py-3 font-semibold">구분</th>
                <th className="px-3 py-3 font-semibold">항목</th>
                <th className="px-3 py-3 font-semibold">목적</th>
                <th className="px-3 py-3 font-semibold">보유 기간</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-border-light">
                <td className="px-3 py-3 text-brown">계정</td>
                <td className="px-3 py-3">이메일, 닉네임, 언어, 로그인 제공자 식별정보, 암호화된 인증정보</td>
                <td className="px-3 py-3">회원 식별, 로그인, 계정 관리</td>
                <td className="px-3 py-3">회원 탈퇴 시까지</td>
              </tr>
              <tr className="border-b border-border-light">
                <td className="px-3 py-3 text-brown">커피 기록</td>
                <td className="px-3 py-3">원두·산지·가공·로스팅 정보, 마신 날짜와 장소, 평가·메모·태그, 구매 정보</td>
                <td className="px-3 py-3">기록 저장·조회·수정·삭제, 통계와 내보내기 제공</td>
                <td className="px-3 py-3">회원 탈퇴 또는 이용자가 직접 삭제할 때까지</td>
              </tr>
              <tr className="border-b border-border-light">
                <td className="px-3 py-3 text-brown">서비스 이용</td>
                <td className="px-3 py-3">필수 인증 쿠키, 접속 시각과 요청 정보 등 보안 기록</td>
                <td className="px-3 py-3">로그인 유지, 장애 대응, 부정 이용 방지와 보안</td>
                <td className="px-3 py-3">인증 만료·로그아웃 또는 보안 목적 달성 시까지</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          위 정보는 「개인정보 보호법」 제15조 제1항 제4호에 따라 서비스 이용계약을 체결하고
          이행하는 데 필요한 범위에서 처리합니다. 관계 법령에 별도의 보존 의무가 생기는 경우에는
          해당 기간 동안 분리하여 보관합니다.
        </p>
      </LegalSection>

      <LegalSection title="2. 수집 방법">
        <p>회원가입과 서비스 이용 중 이용자가 직접 입력한 정보, Google 또는 카카오 로그인을 선택했을 때 해당 로그인 제공자로부터 전달받은 계정 식별정보를 수집합니다.</p>
      </LegalSection>

      <LegalSection title="3. 제3자 제공">
        <p>개인정보를 제3자에게 판매하거나 광고 목적으로 제공하지 않습니다. 법률에 특별한 규정이 있거나 적법한 절차에 따른 요구가 있는 경우에만 관계 법령의 범위에서 제공할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="4. 처리 위탁과 국외 이전">
        <p>서비스 서버와 데이터베이스 운영을 위해 다음과 같이 클라우드 인프라를 이용합니다.</p>
        <dl className="grid gap-x-5 gap-y-2 border-y border-border py-4 sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold text-brown">이전받는 자</dt>
          <dd>
            Oracle Corporation 및 그 계열사 (
            <a className="text-accent underline underline-offset-4" href={legal.oraclePrivacyUrl} target="_blank" rel="noreferrer">
              개인정보 안내
            </a>
            )
          </dd>
          <dt className="font-semibold text-brown">이전 국가</dt>
          <dd>일본(Oracle Cloud Infrastructure 도쿄 리전)</dd>
          <dt className="font-semibold text-brown">이전 항목</dt>
          <dd>이 방침 제1항에 기재된 계정, 커피 기록, 서비스 이용 정보</dd>
          <dt className="font-semibold text-brown">시기·방법</dt>
          <dd>서비스 이용 시 암호화된 네트워크를 통한 전송 및 서버 저장</dd>
          <dt className="font-semibold text-brown">목적</dt>
          <dd>서비스 호스팅, 데이터베이스와 인증 시스템 운영, 보안 유지</dd>
          <dt className="font-semibold text-brown">보유 기간</dt>
          <dd>회원 탈퇴, 개별 기록 삭제 또는 클라우드 서비스 계약 종료 후 삭제가 완료될 때까지</dd>
        </dl>
        <p>
          국외 이전은 「개인정보 보호법」 제28조의8 제1항 제3호에 따라 서비스 계약을 이행하기
          위해 필요한 처리위탁·보관입니다. 국외 이전을 원하지 않으면 가입하지 않거나 설정에서
          회원 탈퇴를 요청할 수 있으나, 현재 인프라 구조상 서비스 이용은 어렵습니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 파기 절차와 방법">
        <p>보유 기간이 끝나거나 처리 목적이 달성되면 지체 없이 파기합니다. 전자 파일은 복구하기 어렵도록 삭제하고, 별도 법적 보존 의무가 있는 정보는 다른 정보와 분리해 보관한 뒤 기간이 끝나면 삭제합니다.</p>
      </LegalSection>

      <LegalSection title="6. 이용자의 권리와 행사 방법">
        <ul className="list-disc space-y-1 pl-5">
          <li>설정에서 닉네임과 언어를 수정하고 전체 커피 기록을 내려받을 수 있습니다.</li>
          <li>각 기록 화면에서 개인정보가 포함될 수 있는 기록을 수정하거나 삭제할 수 있습니다.</li>
          <li>설정의 회원 탈퇴를 통해 계정과 연결된 정보를 삭제할 수 있습니다.</li>
          <li>그 밖의 열람·정정·삭제·처리정지 요청은 아래 연락처로 접수할 수 있습니다.</li>
        </ul>
        <p>법정대리인이나 위임받은 사람도 관계 법령에 따른 확인 절차를 거쳐 권리를 행사할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="7. 쿠키">
        <p>로그인과 보안을 위한 필수 쿠키만 사용합니다. ‘로그인 상태 유지’를 끄면 인증 쿠키는 브라우저를 닫을 때 만료되도록 설정됩니다. 브라우저 설정에서 쿠키를 차단할 수 있지만, 이 경우 로그인이 필요한 기능을 사용할 수 없습니다. 광고, 맞춤형 추천 또는 이용자 행동 추적을 위한 쿠키는 현재 사용하지 않습니다.</p>
      </LegalSection>

      <LegalSection title="8. 안전성 확보 조치">
        <p>전송 구간 암호화, 인증정보 보호, 사용자별 접근 통제, 데이터베이스 행 단위 권한 분리, 입력값 검증, 보안 헤더와 최소 권한 운영 등 기술적·관리적 조치를 적용합니다.</p>
      </LegalSection>

      <LegalSection title="9. 개인정보 보호 문의">
        <LegalContact locale="ko" operatorName={legal.operatorName} contactEmail={legal.contactEmail} />
        <p>
          개인정보 침해에 대한 상담은 개인정보침해 신고센터(
          <a className="text-accent underline underline-offset-4" href="https://privacy.kisa.or.kr" target="_blank" rel="noreferrer">privacy.kisa.or.kr</a>, 118) 또는
          개인정보 분쟁조정위원회(
          <a className="text-accent underline underline-offset-4" href="https://www.kopico.go.kr" target="_blank" rel="noreferrer">kopico.go.kr</a>, 1833-6972)에도 문의할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="10. 방침 변경">
        <p>내용이 변경되면 시행 전에 서비스 화면을 통해 알립니다. 이용자의 권리에 중요한 변경이 있는 경우에는 최소 30일 전에 알립니다.</p>
      </LegalSection>
    </LegalDocument>
  );
}

function EnglishPrivacy() {
  return (
    <LegalDocument
      locale="en"
      eyebrow="Privacy"
      title="Privacy Policy"
      description="beanmap processes only the information needed to provide your coffee journal. We do not use advertising or behavioral-tracking cookies."
      effectiveDate={legal.effectiveDate}
    >
      <LegalSection title="1. Information, purposes, and retention">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-brown">Account:</strong> email, display name, language, sign-in provider identifier, and protected authentication data—for authentication and account management, retained until account deletion.</li>
          <li><strong className="text-brown">Coffee journal:</strong> bean, origin, process, roast, date, place, ratings, notes, tags, and purchase details—to provide journal, statistics, and export features, retained until you delete the record or account.</li>
          <li><strong className="text-brown">Service use:</strong> essential authentication cookies and security request records—to maintain sessions, troubleshoot, and prevent abuse, retained until authentication expires or the security purpose is fulfilled.</li>
        </ul>
        <p>We process this information as necessary to enter into and perform the service agreement under Article 15(1)(4) of Korea’s Personal Information Protection Act.</p>
      </LegalSection>

      <LegalSection title="2. Collection and sharing">
        <p>We collect information you enter directly and, when you choose Google or Kakao sign-in, account identifiers returned by that provider. We do not sell personal information or disclose it for advertising. Disclosure may occur only when required by law and due process.</p>
      </LegalSection>

      <LegalSection title="3. Processor and overseas transfer">
        <p>Oracle Corporation and its affiliates provide hosting infrastructure. Account, journal, and service-use information is encrypted in transit and stored in Oracle Cloud Infrastructure’s Tokyo, Japan region to operate hosting, database, authentication, and security services. It is kept until the related record or account is deleted, or deletion following termination of the cloud contract is complete.</p>
        <p>
          This transfer is necessary to perform the service agreement under Article 28-8(1)(3) of Korea’s Personal Information Protection Act. You may decline by not creating an account or by deleting your account, but the service cannot currently be provided without this infrastructure. See Oracle’s
          <a className="text-accent underline underline-offset-4" href={legal.oraclePrivacyUrl} target="_blank" rel="noreferrer">Services Privacy Policy</a>.
        </p>
      </LegalSection>

      <LegalSection title="4. Deletion and your rights">
        <p>When retention ends or the purpose is fulfilled, electronic files are deleted so they cannot reasonably be restored. You can edit profile data, edit or delete records, export your journal, and delete your account in Settings. Requests for access, correction, deletion, or suspension may also be sent to the contact below.</p>
      </LegalSection>

      <LegalSection title="5. Cookies and security">
        <p>We use only essential authentication cookies. Turning off “Keep me signed in” makes authentication cookies expire when the browser closes. Blocking these cookies prevents signed-in features from working. We apply encryption in transit, per-user access control, database row-level security, input validation, security headers, and least-privilege access.</p>
      </LegalSection>

      <LegalSection title="6. Privacy contact">
        <LegalContact locale="en" operatorName={legal.operatorNameEn} contactEmail={legal.contactEmail} />
      </LegalSection>

      <LegalSection title="7. Changes">
        <p>We will announce changes before they take effect. Material changes affecting user rights will be announced at least 30 days in advance. If the Korean and English versions differ, the Korean version governs.</p>
      </LegalSection>
    </LegalDocument>
  );
}
