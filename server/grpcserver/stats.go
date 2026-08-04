package grpcserver

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	beanlogv1 "beanlog-server/gen/beanlog/v1"

	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// StatsServer implements the gRPC StatsService. Like the REST handlers, every
// request runs in its own transaction lowered to the authenticated role so
// PostgreSQL RLS remains the final authorization boundary.
type StatsServer struct {
	beanlogv1.UnimplementedStatsServiceServer
	pool *pgxpool.Pool
}

func NewStatsServer(pool *pgxpool.Pool) *StatsServer {
	return &StatsServer{pool: pool}
}

func (s *StatsServer) GetStats(ctx context.Context, _ *beanlogv1.GetStatsRequest) (*beanlogv1.GetStatsResponse, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "missing authenticated user")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, status.Error(codes.Unavailable, "database unavailable")
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, "SET LOCAL ROLE authenticated"); err != nil {
		return nil, status.Error(codes.Unavailable, "database unavailable")
	}
	if _, err := tx.Exec(ctx,
		`SELECT set_config('request.jwt.claim.sub', $1, true),
		        set_config('request.jwt.claim.role', 'authenticated', true)`,
		userID,
	); err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid identity")
	}

	rows, err := tx.Query(ctx,
		`SELECT origin_country, process_method, COALESCE(varietal,''), overall_score, consumed_at, name, roastery
		 FROM beans WHERE user_id = $1`, userID,
	)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to query stats")
	}
	defer rows.Close()

	type beanRow struct {
		origin, process, varietal, name, roastery string
		score                                     float64
		consumedAt                                time.Time
	}
	var beanRows []beanRow
	for rows.Next() {
		var b beanRow
		if err := rows.Scan(&b.origin, &b.process, &b.varietal, &b.score, &b.consumedAt, &b.name, &b.roastery); err != nil {
			continue
		}
		beanRows = append(beanRows, b)
	}
	if err := rows.Err(); err != nil {
		return nil, status.Error(codes.Internal, "failed to read stats")
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, status.Error(codes.Internal, "database transaction failed")
	}

	if len(beanRows) == 0 {
		return &beanlogv1.GetStatsResponse{}, nil
	}

	total := len(beanRows)
	var sumScore float64
	best := beanRows[0]
	byOrigin := map[string]int{}
	byProcess := map[string]int{}
	byVarietal := map[string]int{}
	byMonth := map[string]int{}
	scoreDist := map[string]int{}

	for _, b := range beanRows {
		sumScore += b.score
		if b.score > best.score {
			best = b
		}
		byOrigin[b.origin]++
		byProcess[b.process]++
		if b.varietal != "" {
			byVarietal[b.varietal]++
		}
		byMonth[b.consumedAt.Format("2006-01")]++
		scoreDist[fmt.Sprintf("%d", int(math.Floor(b.score)))]++
	}

	resp := &beanlogv1.GetStatsResponse{
		Total:      int32(total),
		AvgScore:   math.Round(sumScore/float64(total)*10) / 10,
		Best:       &beanlogv1.BestBean{Name: best.name, Roastery: best.roastery, Score: best.score},
		ByOrigin:   countEntries(byOrigin, true),
		ByProcess:  countEntries(byProcess, true),
		ByVarietal: countEntries(byVarietal, true),
		ByMonth:    countEntries(byMonth, false),
		ScoreDist:  countEntries(scoreDist, false),
	}
	if len(resp.ByOrigin) > 0 {
		resp.TopOrigin = resp.ByOrigin[0].Key
	}
	if len(resp.ByProcess) > 0 {
		resp.TopProcess = resp.ByProcess[0].Key
	}
	return resp, nil
}

func countEntries(m map[string]int, desc bool) []*beanlogv1.CountEntry {
	entries := make([]*beanlogv1.CountEntry, 0, len(m))
	for k, v := range m {
		entries = append(entries, &beanlogv1.CountEntry{Key: k, Count: int32(v)})
	}
	if desc {
		sort.Slice(entries, func(i, j int) bool { return entries[i].Count > entries[j].Count })
	} else {
		sort.Slice(entries, func(i, j int) bool { return entries[i].Key < entries[j].Key })
	}
	return entries
}
