using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

[ApiController]
[Route("api/[controller]")]
public class RankingsController : ControllerBase
{
    private readonly RankingService _rankingService;

    public RankingsController(RankingService rankingService)
    {
        _rankingService = rankingService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Ranking>>> GetAllRankings()
    {
        var rankings = await _rankingService.GetAllRankings();
        return Ok(rankings);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Ranking>> GetRankingById(int id)
    {
        var ranking = await _rankingService.GetRankingById(id);
        return ranking != null ? Ok(ranking) : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult> AddRanking([FromBody] Ranking ranking)
    {
        await _rankingService.AddRanking(ranking);
        return CreatedAtAction(nameof(GetRankingById), new { id = ranking.Id }, ranking);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateRanking(int id, [FromBody] Ranking ranking)
    {
        if (id != ranking.Id) return BadRequest();

        await _rankingService.UpdateRanking(ranking);
        return NoContent();
    }

    [HttpGet("user/{userId}/total-points")]
    public async Task<ActionResult<double>> GetTotalPointsByUserId(int userId)
    {
        var totalPoints = await _rankingService.GetTotalPointsByUserId(userId);
        return Ok(totalPoints);
    }

    [HttpGet("user/{userId}/total-points-and-rank")]
    public async Task<ActionResult<IEnumerable<object>>> GetTotalPointsAndRankByUserId(int userId)
    {
        var results = await _rankingService.GetTotalPointsAndRankByUserId(userId);
        return Ok(results);
    }
}
