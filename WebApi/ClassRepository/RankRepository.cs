using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Data.SqlClient;
using Dapper;

namespace SpoerStats2.ClassRepository
{
    public class RankRepository : IRankRepository
    {
        private readonly string _connectionString;

        public RankRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Rank>> GetAllRanks()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Rank>("SELECT * FROM Ranks");
            }
        }

        public async Task<Rank> GetRankById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Rank>("SELECT * FROM Ranks WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task AddRank(Rank rank)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Ranks (RankName, MinPoints, MaxPoints) VALUES (@RankName, @MinPoints, @MaxPoints)";
                await connection.ExecuteAsync(query, rank);
            }
        }

        public async Task UpdateRank(Rank rank)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Ranks SET RankName = @RankName, MinPoints = @MinPoints, MaxPoints = @MaxPoints WHERE Id = @Id";
                await connection.ExecuteAsync(query, rank);
            }
        }

        public async Task DeleteRank(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Ranks WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
    }

}
