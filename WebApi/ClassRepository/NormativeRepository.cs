using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Data.SqlClient;
using Dapper;

namespace SpoerStats2.ClassRepository
{
    public class NormativeRepository : INormativeRepository
    {
        private readonly string _connectionString;

        public NormativeRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Normative>> GetAllNormatives()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Normative>("SELECT * FROM Normatives");
            }
        }

        public async Task<Normative> GetNormativeById(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QuerySingleOrDefaultAsync<Normative>("SELECT * FROM Normatives WHERE Id = @Id", new { Id = id });
            }
        }

        public async Task<IEnumerable<Normative>> GetNormativesByDisciplineId(int disciplineId)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Normative>("SELECT * FROM Normatives WHERE DisciplineId = @DisciplineId", new { DisciplineId = disciplineId });
            }
        }

        public async Task AddNormative(Normative normative)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "INSERT INTO Normatives (DisciplineId, Gender, MinAge, MaxAge, ValueStandart, Points) VALUES (@DisciplineId, @Gender, @MinAge, @MaxAge, @ValueStandart, @Points)";
                await connection.ExecuteAsync(query, normative);
            }
        }

        public async Task UpdateNormative(Normative normative)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "UPDATE Normatives SET DisciplineId = @DisciplineId, Gender = @Gender, MinAge = @MinAge, MaxAge = @MaxAge, ValueStandart = @ValueStandart, Points = @Points WHERE Id = @Id";
                await connection.ExecuteAsync(query, normative);
            }
        }

        public async Task DeleteNormative(int id)
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                var query = "DELETE FROM Normatives WHERE Id = @Id";
                await connection.ExecuteAsync(query, new { Id = id });
            }
        }
    }
}
