using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Data.SqlClient;
using Dapper;

namespace SpoerStats2.ClassRepository
{
    public class RankingRepository : IRankingRepository
    {
        private readonly string _connectionString;

        public RankingRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Ranking>> GetAllRankings()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Ranking>("SELECT * FROM Rankings");
            }
        }

        public async Task<Ranking> GetRankingById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Ranking>("SELECT * FROM Rankings WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task<IEnumerable<Ranking>> GetRankingsByUserId(int userId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Ranking>("SELECT * FROM Rankings WHERE UserId = @UserId", new { UserId = userId });
            }
        }

        public async Task AddRanking(Ranking ranking)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Rankings (UserId, DisciplineId, TotalPoints, RankId) VALUES (@UserId, @DisciplineId, @TotalPoints, @RankId)";
                await connection.ExecuteAsync(query, ranking);
            }
        }

        public async Task UpdateRanking(Ranking ranking)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Rankings SET UserId = @UserId, DisciplineId = @DisciplineId, TotalPoints = @TotalPoints, RankId = @RankId WHERE Id = @Id";
                await connection.ExecuteAsync(query, ranking);
            }
        }

        public async Task DeleteRanking(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Rankings WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
        public async Task<double> GetTotalPointsByUserId(int userId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "SELECT SUM(TotalPoints) FROM Rankings WHERE UserId = @UserId";
                return await connection.ExecuteScalarAsync<double>(query, new { UserId = userId });
            }
        }
        public async Task<Rank> GetRankById(int rankId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Rank>("SELECT * FROM Ranks WHERE Id = @RankId", new { RankId = rankId });
            }
        }
    }

}
