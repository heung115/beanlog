import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import designTokens from "@/config/design-tokens.json";

export const alt = "beanmap — coffee journal and world coffee origin guide";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const colors = designTokens.colors;

export default async function OpenGraphImage() {
  const suitBold = await readFile(
    join(
      process.cwd(),
      "node_modules/@sun-typeface/suit/fonts/static/otf/SUIT-Bold.otf"
    )
  );

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: colors.cream,
          color: colors.brown,
          display: "flex",
          fontFamily: "SUIT",
          height: "100%",
          padding: "56px",
          width: "100%",
        }}
      >
        <div
          style={{
            border: `2px solid ${colors.accent}`,
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "54px 62px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.04em",
              }}
            >
              커피 원두 기록
            </span>
            <span
              style={{
                color: colors.accent,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              20개 생산국 산지 정보
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: 67,
                fontWeight: 700,
                letterSpacing: "-0.055em",
                lineHeight: 1.05,
                maxWidth: 940,
              }}
            >
              <span>beanmap</span>
            </div>
            <div
              style={{
                color: colors["brown-medium"],
                display: "flex",
                fontSize: 24,
                marginTop: 28,
              }}
            >
              커피 기록 · 테이스팅 노트 · 20개 생산국 산지 가이드
            </div>
          </div>

          <div
            style={{
              alignItems: "center",
              borderTop: `1px solid ${colors.border}`,
              color: colors["brown-medium"],
              display: "flex",
              fontSize: 20,
              justifyContent: "space-between",
              paddingTop: 24,
            }}
          >
            <span>한국어 · English</span>
            <span style={{ color: colors.accent, fontWeight: 700 }}>
              beanmap.site
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "SUIT",
          data: suitBold,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
