package models

import "time"

type Profile struct {
	ID          string    `json:"id" db:"id"`
	Email       string    `json:"email" db:"email"`
	DisplayName *string   `json:"display_name" db:"display_name"`
	Locale      string    `json:"locale" db:"locale"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type Bean struct {
	ID              string       `json:"id" db:"id"`
	UserID          string       `json:"user_id" db:"user_id"`
	Name            string       `json:"name" db:"name"`
	Roastery        string       `json:"roastery" db:"roastery"`
	BeanType        string       `json:"bean_type" db:"bean_type"`
	OriginCountry   string       `json:"origin_country" db:"origin_country"`
	OriginRegion    *string      `json:"origin_region" db:"origin_region"`
	OriginLat       *float64     `json:"origin_lat" db:"origin_lat"`
	OriginLng       *float64     `json:"origin_lng" db:"origin_lng"`
	FarmProducer    *string      `json:"farm_producer" db:"farm_producer"`
	Varietal        *string      `json:"varietal" db:"varietal"`
	ProcessMethod   string       `json:"process_method" db:"process_method"`
	ProcessDetail   *string      `json:"process_detail" db:"process_detail"`
	AltitudeM       *int         `json:"altitude_m" db:"altitude_m"`
	HarvestYear     *int         `json:"harvest_year" db:"harvest_year"`
	RoastLevel      string       `json:"roast_level" db:"roast_level"`
	RoastDate       *string      `json:"roast_date" db:"roast_date"`
	ConsumedAt      time.Time    `json:"consumed_at" db:"consumed_at"`
	PlaceType       string       `json:"place_type" db:"place_type"`
	CafeName        *string      `json:"cafe_name" db:"cafe_name"`
	CafeLocation    *string      `json:"cafe_location" db:"cafe_location"`
	MenuName        *string      `json:"menu_name" db:"menu_name"`
	OverallScore    float64      `json:"overall_score" db:"overall_score"`
	Note            string       `json:"note" db:"note"`
	ScoreAroma      *int         `json:"score_aroma" db:"score_aroma"`
	ScoreAcidity    *int         `json:"score_acidity" db:"score_acidity"`
	ScoreBody       *int         `json:"score_body" db:"score_body"`
	ScoreSweetness  *int         `json:"score_sweetness" db:"score_sweetness"`
	ScoreAftertaste *int         `json:"score_aftertaste" db:"score_aftertaste"`
	ScoreBalance    *int         `json:"score_balance" db:"score_balance"`
	PurchaseSource  *string      `json:"purchase_source" db:"purchase_source"`
	Price           *int         `json:"price" db:"price"`
	WeightG         *int         `json:"weight_g" db:"weight_g"`
	PurchasedAt     *string      `json:"purchased_at" db:"purchased_at"`
	CreatedAt       time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time    `json:"updated_at" db:"updated_at"`
	TastingTags     []TastingTag `json:"tasting_tags,omitempty"`
}

type TastingTag struct {
	ID       string `json:"id" db:"id"`
	BeanID   string `json:"bean_id" db:"bean_id"`
	UserID   string `json:"user_id" db:"user_id"`
	Tag      string `json:"tag" db:"tag"`
	Category string `json:"category" db:"category"`
}

type OriginPreset struct {
	ID            int      `json:"id" db:"id"`
	Country       string   `json:"country" db:"country"`
	Region        string   `json:"region" db:"region"`
	Lat           *float64 `json:"lat" db:"lat"`
	Lng           *float64 `json:"lng" db:"lng"`
	AltitudeRange *string  `json:"altitude_range" db:"altitude_range"`
	Signature     *string  `json:"signature" db:"signature"`
	KeyVarietals  []string `json:"key_varietals" db:"key_varietals"`
	NameKo        *string  `json:"name_ko" db:"name_ko"`
	NameEn        *string  `json:"name_en" db:"name_en"`
}

// --- Request/Response DTOs ---

type CreateBeanRequest struct {
	Name            string     `json:"name" binding:"required,max=200"`
	Roastery        string     `json:"roastery" binding:"required,max=200"`
	BeanType        string     `json:"bean_type" binding:"required,oneof=single_origin blend"`
	OriginCountry   string     `json:"origin_country" binding:"required,max=100"`
	OriginRegion    *string    `json:"origin_region" binding:"omitempty,max=100"`
	OriginLat       *float64   `json:"origin_lat"`
	OriginLng       *float64   `json:"origin_lng"`
	FarmProducer    *string    `json:"farm_producer" binding:"omitempty,max=200"`
	Varietal        *string    `json:"varietal" binding:"omitempty,max=100"`
	ProcessMethod   string     `json:"process_method" binding:"required,oneof=washed natural honey anaerobic carbonic decaf other"`
	ProcessDetail   *string    `json:"process_detail" binding:"omitempty,max=200"`
	AltitudeM       *int       `json:"altitude_m"`
	HarvestYear     *int       `json:"harvest_year"`
	RoastLevel      string     `json:"roast_level" binding:"required,oneof=light medium dark"`
	RoastDate       *string    `json:"roast_date"`
	ConsumedAt      *string    `json:"consumed_at"`
	PlaceType       string     `json:"place_type" binding:"required,oneof=cafe home"`
	CafeName        *string    `json:"cafe_name"`
	CafeLocation    *string    `json:"cafe_location"`
	MenuName        *string    `json:"menu_name"`
	OverallScore    float64    `json:"overall_score" binding:"required,min=1,max=10"`
	Note            string     `json:"note" binding:"max=2000"`
	ScoreAroma      *int       `json:"score_aroma"`
	ScoreAcidity    *int       `json:"score_acidity"`
	ScoreBody       *int       `json:"score_body"`
	ScoreSweetness  *int       `json:"score_sweetness"`
	ScoreAftertaste *int       `json:"score_aftertaste"`
	ScoreBalance    *int       `json:"score_balance"`
	PurchaseSource  *string    `json:"purchase_source"`
	Price           *int       `json:"price"`
	WeightG         *int       `json:"weight_g"`
	PurchasedAt     *string    `json:"purchased_at"`
	Tags            []TagInput `json:"tags" binding:"max=100,dive"`
}

type TagInput struct {
	Tag      string `json:"tag" binding:"required,max=50"`
	Category string `json:"category" binding:"omitempty,oneof=fruity floral sweet nutty cocoa spice roasted sour green other"`
}

type UpdateBeanRequest = CreateBeanRequest

type BeanFilters struct {
	OriginCountry string `form:"origin_country"`
	ProcessMethod string `form:"process_method"`
	Varietal      string `form:"varietal"`
	Roastery      string `form:"roastery"`
	BeanType      string `form:"bean_type"`
	RoastLevel    string `form:"roast_level"`
	ScoreMin      *int   `form:"score_min"`
	ScoreMax      *int   `form:"score_max"`
	Tag           string `form:"tag"`
	DateFrom      string `form:"date_from"`
	DateTo        string `form:"date_to"`
	Search        string `form:"search"`
	SortBy        string `form:"sort_by"`
	SortOrder     string `form:"sort_order"`
	Page          int    `form:"page"`
	Limit         int    `form:"limit"`
}

type BeanStats struct {
	Total      int          `json:"total"`
	AvgScore   float64      `json:"avg_score"`
	Best       *BestBean    `json:"best"`
	ByOrigin   []CountEntry `json:"by_origin"`
	ByProcess  []CountEntry `json:"by_process"`
	ByVarietal []CountEntry `json:"by_varietal"`
	ByMonth    []CountEntry `json:"by_month"`
	ScoreDist  []CountEntry `json:"score_dist"`
	TopOrigin  *CountEntry  `json:"top_origin"`
	TopProcess *CountEntry  `json:"top_process"`
}

type BestBean struct {
	Name     string  `json:"name"`
	Roastery string  `json:"roastery"`
	Score    float64 `json:"score"`
}

type CountEntry struct {
	Key   string `json:"key"`
	Count int    `json:"count"`
}

type UpdateProfileRequest struct {
	DisplayName string `json:"display_name" binding:"required,max=50"`
	Locale      string `json:"locale" binding:"required,oneof=ko en"`
}
