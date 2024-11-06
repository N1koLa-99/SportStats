using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

public class ResultService
{
    private readonly IResultRepository _resultRepository;

    public ResultService(IResultRepository resultRepository)
    {
        _resultRepository = resultRepository;
    }

    public async Task<IEnumerable<Result>> GetAllResults()
    {
        return await _resultRepository.GetAllResults();
    }

    public async Task<Result> GetResultById(int id)
    {
        return await _resultRepository.GetResultById(id);
    }

    public async Task AddResult(Result result)
    {
        await _resultRepository.AddResult(result);
    }

    public async Task UpdateResult(Result result)
    {
        await _resultRepository.UpdateResult(result);
    }

    public async Task DeleteResult(int id)
    {
        await _resultRepository.DeleteResult(id);
    }
    public async Task<IEnumerable<Result>> GetResultsByUserIdAndDisciplineId(int userId, int disciplineId)
    {
        var results = await _resultRepository.GetResultsByUserId(userId);
        return results.Where(r => r.DisciplineId == disciplineId);
    }
    public async Task<IEnumerable<Result>> GetResultsByUserId(int userId)
    {
        return await _resultRepository.GetResultsByUserId(userId);
    }
}
