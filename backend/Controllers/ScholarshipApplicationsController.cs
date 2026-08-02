using System.Security.Claims;
using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDUMETRICS_DR.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScholarshipApplicationsController : ControllerBase
{
    private readonly IScholarshipApplicationService _scholarshipApplicationService;

    public ScholarshipApplicationsController(IScholarshipApplicationService scholarshipApplicationService)
    {
        _scholarshipApplicationService = scholarshipApplicationService;
    }

    [HttpPost]
    [Authorize(Roles = SystemRoles.Estudiante)]
    public async Task<IActionResult> Create([FromBody] CreateScholarshipApplicationRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var studentCedula = User.FindFirstValue("cedula");
        if (string.IsNullOrWhiteSpace(studentCedula))
        {
            return Unauthorized(new { error = "Token de estudiante sin cédula." });
        }

        try
        {
            var created = await _scholarshipApplicationService.CreateAsync(studentCedula, request, cancellationToken);
            return CreatedAtAction(nameof(GetMine), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("mine")]
    [Authorize(Roles = SystemRoles.Estudiante)]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var studentCedula = User.FindFirstValue("cedula");
        if (string.IsNullOrWhiteSpace(studentCedula))
        {
            return Unauthorized(new { error = "Token de estudiante sin cédula." });
        }

        var applications = await _scholarshipApplicationService.GetMineAsync(studentCedula, cancellationToken);
        return Ok(applications);
    }

    [HttpGet("pending")]
    [Authorize(Roles = SystemRoles.SoloBackoffice)]
    public async Task<IActionResult> GetPending(CancellationToken cancellationToken)
    {
        var applications = await _scholarshipApplicationService.GetPendingAsync(cancellationToken);
        return Ok(applications);
    }

    [HttpGet("economic-analysis")]
    [Authorize(Roles = SystemRoles.SoloBackoffice)]
    public async Task<IActionResult> GetEconomicAnalysisQueue(CancellationToken cancellationToken)
    {
        var applications = await _scholarshipApplicationService.GetInEconomicAnalysisAsync(cancellationToken);
        return Ok(applications);
    }

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = SystemRoles.SoloBackoffice)]
    public async Task<IActionResult> Approve(int id, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _scholarshipApplicationService.ApprovePendingAsync(id, ResolveRole(), ResolveActorEmail(), cancellationToken);
            return updated is null ? NotFound(new { error = "Solicitud no encontrada." }) : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = SystemRoles.SoloBackoffice)]
    public async Task<IActionResult> Reject(int id, [FromBody] RejectScholarshipApplicationRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var updated = await _scholarshipApplicationService.RejectPendingAsync(id, ResolveRole(), ResolveActorEmail(), request.RejectionReason, cancellationToken);
            return updated is null ? NotFound(new { error = "Solicitud no encontrada." }) : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id:int}/complete-economic-analysis")]
    [Authorize(Roles = SystemRoles.SoloBackoffice)]
    public async Task<IActionResult> CompleteEconomicAnalysis(int id, [FromBody] CompleteScholarshipAnalysisRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var updated = await _scholarshipApplicationService.CompleteEconomicAnalysisAsync(id, ResolveRole(), ResolveActorEmail(), request, cancellationToken);
            return updated is null ? NotFound(new { error = "Solicitud no encontrada." }) : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private string ResolveRole()
    {
        return User.FindFirstValue(ClaimTypes.Role) ?? "sin-rol";
    }

    private string ResolveActorEmail()
    {
        return User.FindFirstValue("email")
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? ScholarshipTraceability.InstitutionalEmail;
    }
}