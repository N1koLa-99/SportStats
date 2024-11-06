using SpoerStats2.Models;
using SpoerStats2.Repository;
using Dapper;
using System.Collections.Generic;
using System.Data.SqlClient;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace SpoerStats2.ClassRepository
{
    public class ClubDisciplineRepository : IClubDisciplineRepository
    {
        private readonly string _connectionString;

        public ClubDisciplineRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<ClubDiscipline>> GetAllClubDisciplines()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ClubDiscipline>("SELECT * FROM ClubDisciplines");
            }
        }

        public async Task<ClubDiscipline> GetClubDisciplineById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<ClubDiscipline>(
                    "SELECT * FROM ClubDisciplines WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task<IEnumerable<ClubDiscipline>> GetClubDisciplinesByClubId(int clubId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<ClubDiscipline>(
                    "SELECT * FROM ClubDisciplines WHERE ClubId = @ClubId", new { ClubId = clubId });
            }
        }

        public async Task AddClubDiscipline(ClubDiscipline clubDiscipline)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO ClubDisciplines (ClubId, DisciplineId) VALUES (@ClubId, @DisciplineId)";
                await connection.ExecuteAsync(query, clubDiscipline);
            }
        }

        public async Task UpdateClubDiscipline(ClubDiscipline clubDiscipline)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE ClubDisciplines SET ClubId = @ClubId, DisciplineId = @DisciplineId WHERE Id = @Id";
                await connection.ExecuteAsync(query, clubDiscipline);
            }
        }

        public async Task DeleteClubDiscipline(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM ClubDisciplines WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
    }
}
