using EDUMETRICS_DR.DTOs;
using EDUMETRICS_DR.Filters;
using EDUMETRICS_DR.Models;
using EDUMETRICS_DR.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EDUMETRICS_DR.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = SystemRoles.Administrador)]
public class UsersController : ControllerBase
{
    private readonly IUserManagementService _userManagementService;

    public UsersController(IUserManagementService userManagementService)
    {
        _userManagementService = userManagementService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var users = await _userManagementService.GetAllAsync(cancellationToken);
        return Ok(users);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken cancellationToken)
    {
        var user = await _userManagementService.GetByIdAsync(id, cancellationToken);
        return user is null ? NotFound(new { error = "Usuario no encontrado." }) : Ok(user);
    }

    [HttpPost]
    [ServiceFilter(typeof(AuditActionFilter))]
    [AuditAction("CREAR_USUARIO")]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var created = await _userManagementService.CreateAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [ServiceFilter(typeof(AuditActionFilter))]
    [AuditAction("ACTUALIZAR_USUARIO")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        try
        {
            var updated = await _userManagementService.UpdateAsync(id, request, cancellationToken);
            return updated is null ? NotFound(new { error = "Usuario no encontrado." }) : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    [ServiceFilter(typeof(AuditActionFilter))]
    [AuditAction("REVOCAR_USUARIO")]
    public async Task<IActionResult> Revoke(int id, CancellationToken cancellationToken)
    {
        var revoked = await _userManagementService.RevokeAsync(id, cancellationToken);
        return revoked ? NoContent() : NotFound(new { error = "Usuario no encontrado." });
    }
}