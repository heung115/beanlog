export function GuideNotes({ locale, geography = false }: { locale: string; geography?: boolean }) {
  const isKorean = locale !== "en";

  return (
    <aside className="max-w-3xl space-y-2 text-xs leading-6 text-brown-light" data-testid="origin-guide-notes">
      <p>
        {isKorean
          ? "향미는 지역에 대한 설명과 자료에 기록된 개별 로트의 예시를 함께 정리했습니다. 품종과 가공 목록도 인용된 생산 사례를 기준으로 하며 지역 전체를 망라하지 않습니다. 같은 지역에서도 농장, 품종, 수확 시기, 가공과 로스팅에 따라 달라집니다. 스페셜티 관련 설명은 지역의 생산 사례와 배경이며, 개별 원두의 품질 점수나 등급을 보장하지 않습니다."
          : "Flavor notes combine regional descriptions with documented individual lot examples. Varieties and processing methods likewise describe cited examples, not an exhaustive regional inventory. Lots vary with the farm, variety, harvest, processing, and roast. Specialty context describes regional production; it does not guarantee a quality score or grade for every coffee."}
      </p>
      {geography && (
        <p>
          {isKorean
            ? "산지와 세부 지역은 커피 유통에서 쓰이는 지명을 기준으로 묶었습니다. 행정구역과 경계가 다르거나 서로 겹칠 수 있으며, 상위 산지는 탐색을 위한 연결입니다."
            : "Regions and microregions follow names used in the coffee trade. Their boundaries may overlap or differ from administrative areas; parent regions provide browsing context."}
        </p>
      )}
    </aside>
  );
}
