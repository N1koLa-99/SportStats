using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

[ApiController]
[Route("api/[controller]")]
public class NormativesController : ControllerBase
{
    private readonly NormativeService _normativeService;

    public NormativesController(NormativeService normativeService)
    {
        _normativeService = normativeService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Normative>>> GetAllNormatives()
    {
        var normatives = await _normativeService.GetAllNormatives();
        return Ok(normatives);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Normative>> GetNormativeById(int id)
    {
        var normative = await _normativeService.GetNormativeById(id);
        return normative != null ? Ok(normative) : NotFound();
    }

    [HttpPost]
    public async Task<ActionResult> AddNormative([FromBody] Normative normative)
    {
        await _normativeService.AddNormative(normative);
        return CreatedAtAction(nameof(GetNormativeById), new { id = normative.Id }, normative);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateNormative(int id, [FromBody] Normative normative)
    {
        if (id != normative.Id) return BadRequest();

        await _normativeService.UpdateNormative(normative);
        return NoContent();
    }
    [HttpGet("discipline/{disciplineId}")]
    public async Task<ActionResult<IEnumerable<Normative>>> GetNormativesByDisciplineId(int disciplineId)
    {
        var normatives = await _normativeService.GetNormativesByDisciplineId(disciplineId);
        return Ok(normatives);
    }

}
